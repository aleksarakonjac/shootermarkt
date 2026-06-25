import { RegisterForm } from "./register-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Registracija" };

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-zinc-900">Registracija</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Kreirajte nalog da bi ste upravljali sopstvenim profilom.
        </p>
        <div className="mt-6">
          <RegisterForm />
        </div>
      </div>
    </div>
  );
}
