package inc.aden.omniforge;

import android.app.Activity;
import android.app.ActivityManager;
import android.app.AlertDialog;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.os.StatFs;
import android.provider.OpenableColumns;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import android.content.Context;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import org.json.JSONObject;

import java.io.File;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.FileOutputStream;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * OMNIFORGE Android Lite: designed for Android 10 and low-memory devices.
 * No Cloudflare APIs, hidden network inference or fictitious AI responses.
 * GGUF model loading and generation are guarded by resource checks.
 */
public final class MainActivity extends Activity {
    private static final int IMPORT_MODEL=41;
    private static final int EXPORT_HISTORY=42;
    private static final int BACKGROUND=0xff09121f;
    private static final int SURFACE=0xff142238;
    private static final int EDGE=0xff304563;
    private static final int LIGHT=0xffedf4ff;
    private static final int MUTED=0xffa4b8d3;
    private static final int ACCENT=0xff8db4ff;
    private static final int MINT=0xff9ee0c4;

    private LinearLayout root, messages;
    private ScrollView scroll;
    private EditText composer;
    private TextView status, modelInfo;
    private Button send, importButton;
    private LocalHistory history;
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final AtomicBoolean active=new AtomicBoolean(false);
    private volatile boolean loaded=false;
    private volatile boolean busy=false;
    private final File model() {return new File(new File(getFilesDir(),"models"),"michelle.gguf");}

    @Override public void onCreate(Bundle savedInstance){
        super.onCreate(savedInstance);
        getWindow().setStatusBarColor(BACKGROUND);
        getWindow().setNavigationBarColor(BACKGROUND);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        history=new LocalHistory(this);
        renderShell();
        rebuildHistory();
        if(model().exists() && ModelBridge.supported()) {
            updateStatus("Model file found. Loading local AI…");
            worker.execute(this::loadModel);
        } else if(!ModelBridge.supported()) {
            updateStatus("Native AI unavailable on this Android architecture. Local notes and calculations still work.");
        } else {
            updateStatus("No local AI model installed. Import a GGUF file to enable offline chat.");
        }
    }
    private GradientDrawable background(int base,int stroke,int radius){
        GradientDrawable result=new GradientDrawable();
        result.setColor(base);result.setCornerRadius(dp(radius));
        if(stroke!=0)result.setStroke(dp(1),stroke);
        return result;
    }
    private GradientDrawable gradient(int top,int bottom,int radius){
        GradientDrawable shape=new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{top,bottom});
        shape.setCornerRadius(dp(radius));return shape;
    }
    private int dp(int value){return Math.round(getResources().getDisplayMetrics().density*value);}
    private TextView label(String text,int sp,int color,boolean bold){
        TextView v=new TextView(this);v.setText(text);v.setTextSize(sp);v.setTextColor(color);
        if(bold)v.setTypeface(Typeface.create("sans-serif-medium",Typeface.BOLD));
        return v;
    }
    private LinearLayout column(){LinearLayout view=new LinearLayout(this);view.setOrientation(LinearLayout.VERTICAL);return view;}
    private LinearLayout row(){LinearLayout view=new LinearLayout(this);view.setOrientation(LinearLayout.HORIZONTAL);view.setGravity(Gravity.CENTER_VERTICAL);return view;}
    private LinearLayout.LayoutParams margins(int w,int h,int l,int t,int r,int b){
        LinearLayout.LayoutParams params=new LinearLayout.LayoutParams(w,h);
        params.setMargins(dp(l),dp(t),dp(r),dp(b));return params;
    }
    private Button button(String title,boolean primary){
        Button result=new Button(this);
        result.setText(title);result.setTextSize(12);result.setAllCaps(false);result.setTextColor(primary?BACKGROUND:LIGHT);
        result.setPadding(dp(10),dp(2),dp(10),dp(2));
        result.setMinHeight(dp(42));
        result.setBackground(background(primary?ACCENT:SURFACE,primary?0:EDGE,12));
        return result;
    }
    private void renderShell(){
        root=column();root.setBackgroundColor(BACKGROUND);
        setContentView(root);
        ScrollView chrome=new ScrollView(this);chrome.setFillViewport(false);
        LinearLayout top=column();top.setPadding(dp(18),dp(20),dp(18),dp(4));
        chrome.addView(top);
        root.addView(chrome,new LinearLayout.LayoutParams(-1,-2));
        LinearLayout head=row();
        TextView glyph=label("O✦",22,ACCENT,true);
        glyph.setGravity(Gravity.CENTER);
        glyph.setBackground(gradient(0xff254372,0xff151e37,14));
        head.addView(glyph,margins(dp(50),dp(50),0,0,12,0));
        LinearLayout identity=column();
        identity.addView(label("OMNIFORGE",16,LIGHT,true));
        TextView maker=label("MICHELLE  ·  ADEN INC.",10,MUTED,true);maker.setLetterSpacing(.08f);
        identity.addView(maker,margins(-1,-2,0,4,0,0));
        head.addView(identity,new LinearLayout.LayoutParams(0,-2,1));
        TextView privacy=label("ON DEVICE",10,MINT,true);head.addView(privacy);
        top.addView(head);

        LinearLayout hero=column();
        hero.setPadding(dp(16),dp(15),dp(16),dp(15));
        hero.setBackground(gradient(0xff203a62,0xff121e32,17));
        hero.addView(label("Your private AI workspace",19,LIGHT,true));
        TextView summary=label("Ask, calculate, learn and keep your notes—without accounts or cloud AI.",12,0xffc0d1eb,false);
        summary.setLineSpacing(dp(2),1f);
        hero.addView(summary,margins(-1,-2,0,7,0,8));
        modelInfo=label("",11,MINT,false);hero.addView(modelInfo);
        top.addView(hero,margins(-1,-2,0,18,0,0));

        LinearLayout tools=row();
        importButton=button("＋ Import model",true);
        importButton.setOnClickListener(v->selectModel());
        tools.addView(importButton,new LinearLayout.LayoutParams(0,dp(44),1));
        Button noteButton=button("Notes",false);
        noteButton.setOnClickListener(v->openNotes());
        tools.addView(noteButton,margins(0,dp(44),8,0,0,0));
        Button export=button("Export",false);
        export.setOnClickListener(v->exportHistory());
        tools.addView(export,margins(0,dp(44),8,0,0,0));
        top.addView(tools,margins(-1,dp(44),0,13,0,0));

        status=label("Checking local AI…",12,MUTED,false);
        status.setPadding(dp(13),dp(10),dp(13),dp(10));
        status.setBackground(background(SURFACE,EDGE,12));
        top.addView(status,margins(-1,-2,0,12,0,11));
        LinearLayout section=row();
        section.addView(label("CONVERSATION",11,MUTED,true),new LinearLayout.LayoutParams(0,-2,1));
        Button clear=button("Clear chat",false);
        clear.setOnClickListener(v->confirmClear());
        section.addView(clear);
        top.addView(section,margins(-1,-2,1,0,1,7));

        scroll=new ScrollView(this);
        scroll.setFillViewport(true);
        messages=column();messages.setPadding(dp(18),dp(10),dp(18),dp(18));
        scroll.addView(messages);
        root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));

        LinearLayout bottom=column();
        bottom.setPadding(dp(14),dp(8),dp(14),dp(14));
        bottom.setBackgroundColor(0xff101c2d);
        LinearLayout inputRow=row();
        composer=new EditText(this);
        composer.setHint("Ask MICHELLE or calculate 2 × 3…");
        composer.setHintTextColor(0xff8294b1);composer.setTextColor(LIGHT);
        composer.setTextSize(14);composer.setMinLines(1);composer.setMaxLines(4);
        composer.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_MULTI_LINE|InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        composer.setPadding(dp(13),dp(8),dp(13),dp(8));
        composer.setBackground(background(SURFACE,EDGE,13));
        inputRow.addView(composer,new LinearLayout.LayoutParams(0,-2,1));
        send=button("Send",true);send.setOnClickListener(v->sendMessage());
        inputRow.addView(send,margins(0,dp(48),8,0,0,0));
        bottom.addView(inputRow);
        TextView foot=label("OFFLINE · LOCAL STORAGE · NO CLOUD FEES",10,0xff8298b8,true);
        foot.setGravity(Gravity.CENTER);foot.setLetterSpacing(.12f);
        bottom.addView(foot,margins(-1,-2,0,10,0,0));
        root.addView(bottom);
    }
    private void updateStatus(String message){
        runOnUiThread(()->{
            if(status!=null)status.setText(message);
            if(modelInfo!=null)modelInfo.setText("Android "+Build.VERSION.RELEASE+" · "+android.os.Build.SUPPORTED_ABIS[0]+" · "+(loaded?"AI READY":"LOCAL TOOLS READY"));
        });
    }
    private void bubble(String role,String text,String engine){
        LinearLayout line=column();
        boolean mine="user".equals(role);
        line.setPadding(dp(14),dp(11),dp(14),dp(13));
        line.setBackground(background(mine?0xff274773:SURFACE,mine?0:EDGE,15));
        TextView by=label(mine?"YOU":engine,10,mine?0xffcee2ff:MINT,true);
        by.setLetterSpacing(.09f);
        line.addView(by);
        TextView body=label(text,14,LIGHT,false);
        body.setLineSpacing(dp(3),1f);
        body.setTextIsSelectable(true);
        line.addView(body,margins(-1,-2,0,5,0,0));
        LinearLayout.LayoutParams lp=margins(-1,-2,mine?37:0,3,mine?0:23,10);
        messages.addView(line,lp);
        scroll.post(()->scroll.fullScroll(View.FOCUS_DOWN));
    }
    private void rebuildHistory(){
        messages.removeAllViews();
        List<JSONObject> all=history.messages();
        if(all.isEmpty()){
            LinearLayout welcome=column();
            welcome.setPadding(dp(18),dp(25),dp(18),dp(24));
            welcome.addView(label("A quiet space to think.",22,LIGHT,true));
            TextView subtitle=label("Your chats remain on this device. Start with a calculation or import a local language model for conversation.",13,MUTED,false);
            subtitle.setLineSpacing(dp(3),1f);
            welcome.addView(subtitle,margins(-1,-2,0,9,0,0));
            messages.addView(welcome);
        }else{
            for(JSONObject item:all)bubble(item.optString("role"),item.optString("text"),item.optString("engine","MICHELLE"));
        }
    }
    private void sendMessage(){
        String text=composer.getText().toString().trim();
        if(text.isEmpty()||busy)return;
        if(text.length()>1800){updateStatus("Keep each message under 1,800 characters on this device.");return;}
        if(!history.add("user",text,"YOU")){updateStatus("Storage failed. Export your chat before continuing.");return;}
        composer.setText("");
        rebuildHistory();
        String arithmetic=OfflineMath.solve(text);
        if(arithmetic!=null){
            if(!history.add("michelle",arithmetic,"OFFLINE CALCULATOR"))updateStatus("Could not save calculation.");
            rebuildHistory();return;
        }
        if(!loaded){
            updateStatus("A local language model is not loaded. Choose 'Import model' to enable real AI conversations.");
            return;
        }
        ActivityManager.MemoryInfo info=new ActivityManager.MemoryInfo();
        ((ActivityManager)getSystemService(ACTIVITY_SERVICE)).getMemoryInfo(info);
        if(info.lowMemory||info.availMem<300L*1024*1024){
            updateStatus("Android has insufficient free RAM to start inference safely. Close other apps and try again.");
            return;
        }
        busy=true;send.setText("Stop");
        send.setOnClickListener(v->{ModelBridge.nativeStop();updateStatus("Stopping local generation…");});
        updateStatus("MICHELLE is generating locally. The first reply can be slow on 2 GB RAM.");
        final String prompt=buildPrompt(text);
        worker.execute(()->{
            try {
                String response=ModelBridge.nativeReply(prompt,128);
                if(response==null||response.trim().isEmpty())throw new IllegalStateException("The model returned no answer.");
                if(!history.add("michelle",response.trim(),"ON-DEVICE AI"))throw new IllegalStateException("Could not save the model response.");
                runOnUiThread(()->{rebuildHistory();updateStatus("Generated locally. Verify important claims and calculations.");});
            }catch(Throwable error){updateStatus("Local inference failed: "+String.valueOf(error.getMessage()));}
            finally{runOnUiThread(()->{busy=false;send.setText("Send");send.setOnClickListener(v->sendMessage());});}
        });
    }
    private String buildPrompt(String current){
        StringBuilder out=new StringBuilder();
        out.append("<|im_start|>system\nYou are MICHELLE, a private offline AI in OMNIFORGE by ADEN INC. Be helpful, clear and concise. Admit uncertainty. You have no internet access or external app control. Never invent actions, current data or sources.<|im_end|>\n");
        List<JSONObject> all=history.messages();
        int first=Math.max(0,all.size()-5);
        for(int i=first;i<all.size();i++){
            JSONObject item=all.get(i);
            if(i==all.size()-1)break;
            String role="user".equals(item.optString("role"))?"user":"assistant";
            String text=item.optString("text");if(text.length()>220)text=text.substring(0,220);
            out.append("<|im_start|>").append(role).append('\n').append(text).append("<|im_end|>\n");
        }
        out.append("<|im_start|>user\n").append(current).append("<|im_end|>\n<|im_start|>assistant\n");
        return out.toString();
    }
    private void selectModel(){
        if(busy){updateStatus("Stop the current generation before importing another model.");return;}
        new AlertDialog.Builder(this)
                .setTitle("Offline language model")
                .setMessage("Choose a trusted GGUF model file from your phone. For this 2 GB device, start with Qwen2.5 0.5B Instruct Q4_K_M. Importing requires roughly 450 MB free plus working space. The model remains private; nothing is uploaded.")
                .setPositiveButton("Choose GGUF",(d,w)->{
                    Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    intent.setType("*/*");intent.addCategory(Intent.CATEGORY_OPENABLE);
                    startActivityForResult(intent,IMPORT_MODEL);
                })
                .setNeutralButton("Get official model",(d,w)->{
                    new AlertDialog.Builder(this)
                            .setTitle("Model download · about 491 MB")
                            .setMessage("This opens the official Qwen model page in your browser. Downloading approximately 491 MB may incur mobile-data charges. You can also transfer the GGUF file from another device. After importing it, MICHELLE runs the model offline.")
                            .setPositiveButton("Open official page",(confirm,choice)->{
                                try{
                                    startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/blob/main/qwen2.5-0.5b-instruct-q4_k_m.gguf")));
                                }catch(android.content.ActivityNotFoundException e){updateStatus("No web browser is installed. Transfer a trusted GGUF file to the phone instead.");}
                            })
                            .setNegativeButton("Cancel",null).show();
                })
                .setNegativeButton("Cancel",null).show();
    }
    private void loadModel(){
        if(!ModelBridge.supported()){updateStatus("This build does not contain a native AI engine for the device's architecture.");return;}
        ActivityManager.MemoryInfo mi=new ActivityManager.MemoryInfo();
        ((ActivityManager)getSystemService(ACTIVITY_SERVICE)).getMemoryInfo(mi);
        if(mi.lowMemory){updateStatus("Android reports low memory. Free RAM before loading a model.");return;}
        try {
            loaded=ModelBridge.nativeLoad(model().getAbsolutePath());
            updateStatus(loaded?"On-device model loaded. Ask MICHELLE a short question.":"The model did not load.");
        }catch(Throwable error){loaded=false;updateStatus("Could not load model: "+error.getMessage());}
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(result!=RESULT_OK||data==null||data.getData()==null)return;
        if(request==IMPORT_MODEL)importModel(data.getData());
        if(request==EXPORT_HISTORY)writeExport(data.getData());
    }
    private void importModel(Uri uri){
        if(!active.compareAndSet(false,true)){updateStatus("Another file import is in progress.");return;}
        updateStatus("Reading and verifying the selected GGUF file…");
        worker.execute(()->{
            File directory=new File(getFilesDir(),"models");
            File partial=new File(directory,"import.partial");
            try {
                if(!directory.exists()&&!directory.mkdirs())throw new IllegalStateException("Cannot create private model folder.");
                StatFs stats=new StatFs(directory.getAbsolutePath());
                long free=stats.getAvailableBytes();
                if(free<560L*1024*1024)throw new IllegalStateException("Not enough free storage for the model and temporary files.");
                try(InputStream in=getContentResolver().openInputStream(uri);
                    OutputStream out=new FileOutputStream(partial)){
                    if(in==null)throw new IllegalStateException("The selected file cannot be opened.");
                    byte[] head=new byte[4];
                    int offset=0;
                    while(offset<4){int n=in.read(head,offset,4-offset);if(n<0)break;offset+=n;}
                    if(offset!=4||head[0]!='G'||head[1]!='G'||head[2]!='U'||head[3]!='F')
                        throw new IllegalArgumentException("Not a GGUF model file.");
                    out.write(head);long length=4;
                    byte[] buffer=new byte[65536];int got;
                    while((got=in.read(buffer))>=0){
                        if(got==0)continue;
                        length+=got;
                        if(length>900L*1024*1024)throw new IllegalArgumentException("This model is too large for Android Lite.");
                        if(stats.getAvailableBytes()<125L*1024*1024)throw new IllegalStateException("Storage is almost full.");
                        out.write(buffer,0,got);
                    }
                    if(length<10L*1024*1024)throw new IllegalArgumentException("Model file is incomplete.");
                    out.flush();
                }
                if(ModelBridge.supported())ModelBridge.nativeRelease();
                loaded=false;
                Files.move(partial.toPath(),model().toPath(),StandardCopyOption.REPLACE_EXISTING);
                updateStatus("Model imported. Loading local AI without internet…");
                loadModel();
            }catch(Throwable error){partial.delete();updateStatus("Model import failed: "+error.getMessage());}
            finally{active.set(false);}
        });
    }
    private void exportHistory(){
        Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.setType("application/json");intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.putExtra(Intent.EXTRA_TITLE,"omniforge-android-conversations.json");
        startActivityForResult(intent,EXPORT_HISTORY);
    }
    private void writeExport(Uri uri){
        worker.execute(()->{
            try(OutputStream out=getContentResolver().openOutputStream(uri,"wt")){
                if(out==null)throw new IllegalStateException("Cannot write to the selected location.");
                out.write(history.exportJSON().getBytes(java.nio.charset.StandardCharsets.UTF_8));
                out.flush();updateStatus("Conversation exported to your chosen file.");
            }catch(Exception error){updateStatus("Export failed: "+error.getMessage());}
        });
    }
    private void openNotes(){
        EditText note=new EditText(this);
        note.setText(getPreferences(MODE_PRIVATE).getString("notes",""));
        note.setHint("Private notes, plans, reminders and ideas");
        note.setMinLines(6);note.setGravity(Gravity.TOP);
        LinearLayout frame=column();frame.setPadding(dp(16),dp(6),dp(16),0);frame.addView(note);
        new AlertDialog.Builder(this).setTitle("Your private notes").setView(frame)
                .setPositiveButton("Save",(d,w)->{
                    boolean ok=getPreferences(MODE_PRIVATE).edit().putString("notes",note.getText().toString().substring(0,Math.min(note.length(),15000))).commit();
                    updateStatus(ok?"Notes saved privately on this device.":"Could not save your notes.");
                })
                .setNegativeButton("Cancel",null).show();
    }
    private void confirmClear(){
        new AlertDialog.Builder(this).setTitle("Clear conversation?")
                .setMessage("This removes the saved local chat history. Export it first if you want to keep a copy.")
                .setPositiveButton("Clear",(d,w)->{
                    if(history.clear()){rebuildHistory();updateStatus("Conversation cleared. Notes and model file were kept.");}
                    else updateStatus("Could not clear saved history.");
                })
                .setNegativeButton("Cancel",null).show();
    }
    @Override protected void onStop(){super.onStop();if(busy&&ModelBridge.supported())ModelBridge.nativeStop();}
    @Override protected void onDestroy(){
        if(ModelBridge.supported())ModelBridge.nativeStop();
        worker.execute(()->{if(ModelBridge.supported())ModelBridge.nativeRelease();});
        worker.shutdown();
        super.onDestroy();
    }
}
