package inc.aden.omniforge;
import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

/** Device-local records. No accounts, network sync or private transcript logging. */
public final class LocalHistory {
    private final SharedPreferences store;
    private final List<JSONObject> records=new ArrayList<>();
    LocalHistory(Context context){
        store=context.getSharedPreferences("michelle_local_v1",Context.MODE_PRIVATE);
        try {
            JSONArray data=new JSONArray(store.getString("history","[]"));
            for(int i=0;i<data.length();i++){
                JSONObject item=data.optJSONObject(i);
                if(item!=null && ("user".equals(item.optString("role"))||"michelle".equals(item.optString("role"))))
                    records.add(item);
            }
        }catch(JSONException ignored){}
        trim();
    }
    synchronized List<JSONObject> messages(){return new ArrayList<>(records);}
    synchronized boolean add(String role,String text,String engine){
        if(!"user".equals(role)&&!"michelle".equals(role))throw new IllegalArgumentException("Role");
        try{
            JSONObject msg=new JSONObject();
            msg.put("role",role);msg.put("text",text.substring(0,Math.min(text.length(),6000)));
            msg.put("engine",engine);msg.put("at",System.currentTimeMillis());
            records.add(msg);trim();return save();
        }catch(JSONException e){return false;}
    }
    synchronized boolean clear(){records.clear();return save();}
    synchronized String exportJSON(){
        JSONObject data=new JSONObject();
        try{
            data.put("format","omniforge-android-lite-v1");
            data.put("messages",new JSONArray(records));
            return data.toString(2);
        }catch(JSONException e){return "{}";}
    }
    /** Replace only after verifying the entire backup and writing it successfully. */
    synchronized int importJSON(String json) throws JSONException {
        if(json==null || json.length()>1100000)throw new JSONException("Backup is too large.");
        JSONObject root=new JSONObject(json);
        if(!"omniforge-android-lite-v1".equals(root.optString("format")))throw new JSONException("Unsupported backup format.");
        JSONArray values=root.optJSONArray("messages");
        if(values==null || values.length()>80)throw new JSONException("Backup must contain at most 80 messages.");
        List<JSONObject> validated=new ArrayList<>();
        for(int i=0;i<values.length();i++){
            JSONObject source=values.optJSONObject(i);
            if(source==null)throw new JSONException("Invalid message in backup.");
            String role=source.optString("role");
            if(!"user".equals(role)&&!"michelle".equals(role))throw new JSONException("Invalid message role.");
            String text=source.optString("text");
            if(text.length()>6000)throw new JSONException("A message exceeds the allowed length.");
            String engine=source.optString("engine","RESTORED");
            if(engine.length()>60)throw new JSONException("Invalid engine label.");
            JSONObject clean=new JSONObject();
            clean.put("role",role);clean.put("text",text);clean.put("engine",engine);
            clean.put("at",source.optLong("at",0));
            validated.add(clean);
        }
        if(!store.edit().putString("history",new JSONArray(validated).toString()).commit())
            throw new JSONException("Device storage could not save the restored backup.");
        records.clear();
        records.addAll(validated);
        return records.size();
    }
    private void trim(){while(records.size()>80)records.remove(0);}
    private boolean save(){return store.edit().putString("history",new JSONArray(records).toString()).commit();}
}
