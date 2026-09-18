import { AuthForm } from "@/components/auth/auth-form";
import { loginAction } from "@/lib/actions/auth";
export default function LoginPage(){ return <AuthForm mode="login" action={loginAction}/>; }
