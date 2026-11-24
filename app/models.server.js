import prisma from "./db.server";

export async function listFaqs(shop) {
  return prisma.faq.findMany({ where: { shop }, orderBy: { createdAt: "desc" } });
}

export async function saveFaq(shop, faq) {
  if (!faq.question.trim() || !faq.answer.trim()) throw new Response("Question and answer are required.", { status: 400 });
  return prisma.faq.create({ data: { shop, question: faq.question.trim(), answer: faq.answer.trim() } });
}

export async function listTickets(shop) {
  return prisma.ticket.findMany({ where: { shop }, orderBy: { createdAt: "desc" } });
}
