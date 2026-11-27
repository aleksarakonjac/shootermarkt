"use server";

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// MX for shootermarkt.com points to Resend, so TO lands in the Resend receiving inbox.
const FROM = "Shootermarkt <form@shootermarkt.com>";
const TO = "contact@shootermarkt.com";

export type ContactState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error" };

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

  // The client shows field errors; this only guards direct calls to the action.
  if (
    !name.trim() || name.length > 200 ||
    !isValidEmail(email) || email.length > 320 ||
    !topic || topic.length > 100 ||
    message.trim().length < 20 || message.length > 5000
  ) {
    return { status: "error" };
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
      return { status: "error" };
    }

    return { status: "success" };
  } catch (err) {
    console.error("Contact form error:", err);
    return { status: "error" };
  }
}
