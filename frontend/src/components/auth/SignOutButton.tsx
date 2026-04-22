"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button className="ui-button w-fit cursor-pointer" type="button" onClick={() => signOut({ callbackUrl: "/login" })}>
      Sign out
    </button>
  );
}
