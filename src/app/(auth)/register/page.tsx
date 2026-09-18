import { AuthForm } from "@/components/auth/auth-form";
import { registerAction } from "@/lib/actions/auth";
export default function RegisterPage(){ return <AuthForm mode="register" action={registerAction}/>; }
