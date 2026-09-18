import { AuthForm } from "@/components/auth/auth-form";
import { forgotPasswordAction } from "@/lib/actions/auth";
export default function ForgotPage(){ return <AuthForm mode="forgot" action={forgotPasswordAction}/>; }
