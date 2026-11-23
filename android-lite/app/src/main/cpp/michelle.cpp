#include <jni.h>
#include <android/log.h>
#include <atomic>
#include <mutex>
#include <string>
#include <vector>
#include <algorithm>
#include "llama.h"

// Native inference never uses an external API.  One model, one request at a time.
// A model load is still experimental on 2 GB RAM; callers must check Android's
// low-memory indicators before invoking this library.
namespace {
std::mutex gate;
std::once_flag initOnce;
std::atomic<bool> cancelled{false};
llama_model* loadedModel = nullptr;
llama_context* context = nullptr;

void throwJava(JNIEnv* env, const std::string& message) {
    jclass cls=env->FindClass("java/lang/IllegalStateException");
    if(cls) env->ThrowNew(cls,message.c_str());
}
std::string stringFromJni(JNIEnv* env,jstring arg) {
    if(!arg)return "";
    const char* ptr=env->GetStringUTFChars(arg,nullptr);
    if(!ptr)return "";
    std::string result(ptr);
    env->ReleaseStringUTFChars(arg,ptr);
    return result;
}
bool queueTokens(llama_batch_ext* batch,const llama_token* ids,int count,int position,bool logits){
    llama_batch_ext_clear(batch);
    for(int i=0;i<count;++i){
        const int index=llama_batch_ext_add_token(batch,0,ids[i]);
        if(index<0)return false;
        const llama_pos pos=position+i;
        if(!llama_batch_ext_set_pos(batch,index,&pos))return false;
    }
    if(logits&&!llama_batch_ext_set_output_logits(batch,count-1,true))return false;
    return true;
}
void release(){
    if(context){llama_free(context);context=nullptr;}
    if(loadedModel){llama_model_free(loadedModel);loadedModel=nullptr;}
}
}
extern "C" JNIEXPORT jboolean JNICALL
Java_inc_aden_omniforge_ModelBridge_nativeLoad(JNIEnv* env,jclass,jstring file){
    const std::string path=stringFromJni(env,file);
    if(path.empty()){throwJava(env,"Choose a model first.");return JNI_FALSE;}
    std::lock_guard<std::mutex> lock(gate);
    cancelled.store(true);
    release();
    std::call_once(initOnce,[]{llama_backend_init();});
    auto params=llama_model_default_params();
    params.n_gpu_layers=0; // CPU only on low-memory Android.
    loadedModel=llama_model_load_from_file(path.c_str(),params);
    if(!loadedModel){throwJava(env,"The GGUF model could not be loaded. Check its architecture and memory requirements.");return JNI_FALSE;}
    auto cparams=llama_context_default_params();
    cparams.n_ctx=1024;
    cparams.n_batch=128;
    cparams.n_ubatch=128;
    cparams.n_threads=2;
    cparams.n_threads_batch=2;
    context=llama_init_from_model(loadedModel,cparams);
    if(!context){
       release();
       throwJava(env,"The model needs more free memory than is currently available.");
       return JNI_FALSE;
    }
    cancelled.store(false);
    return JNI_TRUE;
}
extern "C" JNIEXPORT jstring JNICALL
Java_inc_aden_omniforge_ModelBridge_nativeReply(JNIEnv* env,jclass,jstring request,jint maxOutput){
    const std::string prompt=stringFromJni(env,request);
    if(prompt.empty()){throwJava(env,"Write a message first.");return nullptr;}
    std::lock_guard<std::mutex> lock(gate);
    if(!context||!loadedModel){throwJava(env,"A local model is not loaded.");return nullptr;}
    cancelled.store(false);
    llama_memory_clear(llama_get_memory(context),true);
    const llama_vocab* vocab=llama_model_get_vocab(loadedModel);
    const int needed=llama_tokenize(vocab,prompt.c_str(),prompt.size(),nullptr,0,true,true);
    if(needed>=0||-needed>768){
       throwJava(env,"Message is too long for Lite's 1,024-token context. Shorten the conversation.");
       return nullptr;
    }
    std::vector<llama_token> tokens(-needed);
    const int count=llama_tokenize(vocab,prompt.c_str(),prompt.size(),tokens.data(),tokens.size(),true,true);
    if(count<=0){throwJava(env,"Could not tokenize this prompt.");return nullptr;}
    llama_batch_ext* batch=llama_batch_ext_init(context);
    llama_sampler* sampler=llama_sampler_init_greedy();
    if(!batch||!sampler){
       if(batch)llama_batch_ext_free(batch);
       if(sampler)llama_sampler_free(sampler);
       throwJava(env,"Could not allocate the local inference workspace.");
       return nullptr;
    }
    int pos=0;
    bool failed=false;
    while(pos<count&&!cancelled.load()){
       int size=std::min(96,count-pos);
       if(!queueTokens(batch,tokens.data()+pos,size,pos,pos+size==count) ||
          llama_process(context,LLAMA_PROCESS_TYPE_DECODE,batch)!=0){failed=true;break;}
       pos+=size;
    }
    std::string output;
    const int limit=std::max(1,std::min(160,(int)maxOutput));
    for(int generated=0;!failed&&!cancelled.load()&&generated<limit&&pos+generated<1018;++generated){
       const llama_token id=llama_sampler_sample(sampler,context,-1);
       if(llama_vocab_is_eog(vocab,id))break;
       char piece[4096];
       int n=llama_token_to_piece(vocab,id,piece,sizeof(piece),0,true);
       if(n>0)output.append(piece,n);
       if(!queueTokens(batch,&id,1,pos+generated,true) ||
          llama_process(context,LLAMA_PROCESS_TYPE_DECODE,batch)!=0){failed=true;break;}
    }
    llama_sampler_free(sampler);
    llama_batch_ext_free(batch);
    if(failed){throwJava(env,"Local inference failed. Try a shorter message or restart MICHELLE.");return nullptr;}
    if(cancelled.load())return env->NewStringUTF("[Generation stopped]");
    if(output.empty())return env->NewStringUTF("[The local model produced no text]");
    return env->NewStringUTF(output.c_str());
}
extern "C" JNIEXPORT void JNICALL
Java_inc_aden_omniforge_ModelBridge_nativeStop(JNIEnv*,jclass){
    cancelled.store(true);
}
extern "C" JNIEXPORT void JNICALL
Java_inc_aden_omniforge_ModelBridge_nativeRelease(JNIEnv*,jclass){
    cancelled.store(true);
    std::lock_guard<std::mutex> lock(gate);
    release();
}
