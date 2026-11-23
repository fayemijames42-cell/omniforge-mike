package inc.aden.omniforge;
public final class OfflineMathTest {
    private static void expect(String input,String expected){
        String got=OfflineMath.solve(input);
        if(expected==null?got!=null:!expected.equals(got))
            throw new AssertionError(input+": expected ["+expected+"] but got ["+got+"]");
    }
    public static void main(String[] ignored){
        expect("Calculate 2+3*4","2+3*4 = 14");
        expect("calculate (12+8)*3^2","(12+8)*3^2 = 180");
        expect("What is -(2+3)^2?","-(2+3)^2 = -25");
        expect("calculate 2^3^2","2^3^2 = 512");
        expect("calculate 8/0",null);
        expect("tell me how to code",null);
        expect("calculate process.exit(0)",null);
        expect("calculate (2 + 4",null);
        System.out.println("PASS: 8 deterministic arithmetic safety and precedence checks");
    }
}
