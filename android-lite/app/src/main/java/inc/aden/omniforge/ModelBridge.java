package inc.aden.omniforge;

public final class ModelBridge {
    private static final boolean LIBRARY_PRESENT;
    static {
        boolean available;
        try { System.loadLibrary("michelle"); available=true; }
        catch (UnsatisfiedLinkError | SecurityException error) { available=false; }
        LIBRARY_PRESENT=available;
    }
    private ModelBridge(){}
    public static boolean supported(){return LIBRARY_PRESENT;}
    public static native boolean nativeLoad(String path);
    public static native String nativeReply(String prompt,int maxTokens);
    public static native void nativeStop();
    public static native void nativeRelease();
}
