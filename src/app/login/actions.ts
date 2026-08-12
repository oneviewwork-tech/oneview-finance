"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

export async function authenticate(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // Deliberately the same message whether the account doesn't exist,
      // the password is wrong, or the account is locked — see auth.ts for
      // why (never let the login form itself leak which case applies).
      return "Invalid email or password.";
    }
    throw error;
  }
}
