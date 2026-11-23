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
    private void trim(){while(records.size()>80)records.remove(0);}
    private boolean save(){return store.edit().putString("history",new JSONArray(records).toString()).commit();}
}
