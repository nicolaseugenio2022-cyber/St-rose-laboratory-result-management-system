"use server";

import { userService } from "@/services/userService";
import { createSession, deleteSession } from "@/lib/session";
import { redirect } from "next/navigation";

export async function loginAction(formData: FormData) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;
  const rememberMe = formData.get("rememberMe") === "true";

  if (!username || !password) {
    return { success: false, error: "Username and password are required" };
  }

  try {
    const user = await userService.authenticate(username, password);
    await createSession(user.id, rememberMe);
  } catch (error: any) {
    return { success: false, error: "Invalid username or password." };
  }

  // Redirect must happen outside the try-catch block for Next.js to handle it properly
  redirect("/dashboard");
}

export async function logoutAction() {
  await deleteSession();
  redirect("/login");
}
