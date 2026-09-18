import { AuthForm } from "@/components/auth/auth-form";
import { resetPasswordAction } from "@/lib/actions/auth";
export default function ResetPage(){ return <AuthForm mode="reset" action={resetPasswordAction}/>; }
