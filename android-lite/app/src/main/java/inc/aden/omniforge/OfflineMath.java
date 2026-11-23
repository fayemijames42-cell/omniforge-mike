package inc.aden.omniforge;

import java.util.Locale;
import java.util.regex.Pattern;

/** Deterministic offline arithmetic, no JavaScript eval and no language-model claims. */
public final class OfflineMath {
    private OfflineMath(){}
    private static final Pattern ALLOWED=Pattern.compile("[0-9.()+\\-*/^\\s]{1,100}");
    public static String solve(String message) {
        if(message==null)return null;
        String expr=message.trim().replaceFirst("(?i)^(please\\s+)?(calculate|compute|evaluate|what is|what's)\\s*","").replaceFirst("\\?$","").trim();
        if(!ALLOWED.matcher(expr).matches() || !expr.matches(".*[+*/^\\-].*"))return null;
        try {
            Parser parser=new Parser(expr.replaceAll("\\s+",""));
            double n=parser.expression();
            if(parser.i!=parser.s.length() || !Double.isFinite(n) || Math.abs(n)>1e12)return null;
            String answer=Math.abs(n-Math.rint(n))<1e-9 ? Long.toString(Math.round(n)) :
                    String.format(Locale.US,"%.9g",n);
            return expr+" = "+answer;
        }catch(RuntimeException ignored){return null;}
    }
    static final class Parser {
        final String s;int i=0;
        Parser(String input){s=input;}
        boolean take(char c){if(i<s.length()&&s.charAt(i)==c){i++;return true;}return false;}
        double expression(){
            double v=term();
            while(true){if(take('+'))v+=term();else if(take('-'))v-=term();else return v;}
        }
        double term(){
            double v=unary();
            while(true){if(take('*'))v*=unary();else if(take('/')){
                double divisor=unary();if(divisor==0)throw new ArithmeticException();v/=divisor;
            }else return v;}
        }
        double unary(){if(take('+'))return unary();if(take('-'))return -unary();return pow();}
        double pow(){double v=atom();return take('^')?Math.pow(v,unary()):v;}
        double atom(){
            if(take('(')){double v=expression();if(!take(')'))throw new IllegalArgumentException();return v;}
            int start=i;
            while(i<s.length()&&(Character.isDigit(s.charAt(i))||s.charAt(i)=='.'))i++;
            if(i==start)throw new IllegalArgumentException();
            return Double.parseDouble(s.substring(start,i));
        }
    }
}
