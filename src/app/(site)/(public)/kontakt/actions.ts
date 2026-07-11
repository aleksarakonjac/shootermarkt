"use server";

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Update `from` once shootermarkt.com is verified in Resend dashboard
const FROM = "Shootermarkt <onboarding@resend.dev>";
const TO = "kontakt@shootermarkt.com";

export type ContactState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function sendContactMessage(data: {
  name: string;
  email: string;
  topic: string;
  message: string;
}): Promise<ContactState> {
  const { name, email, topic, message } = data;

  if (!name.trim() || !email.trim() || !topic || !message.trim()) {
    return { status: "error", message: "Sva polja su obavezna." };
  }
  if (!isValidEmail(email)) {
    return { status: "error", message: "Email adresa nije ispravna." };
  }
  if (message.trim().length < 20) {
    return { status: "error", message: "Poruka mora imati najmanje 20 karaktera." };
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: [TO],
      replyTo: email,
      subject: `[${topic}] ${name}`,
      text: [
        `Ime: ${name}`,
        `Email: ${email}`,
        `Tema: ${topic}`,
        "",
        message,
      ].join("\n"),
    });

    if (error) {
      console.error("Resend error:", error);
      return { status: "error", message: "Greška pri slanju. Pokušajte ponovo." };
    }

    return { status: "success" };
  } catch (err) {
    console.error("Contact form error:", err);
    return { status: "error", message: "Greška pri slanju. Pokušajte ponovo." };
  }
}
