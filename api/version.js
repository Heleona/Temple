export default function handler(_req, res){
  res.status(200).json({ app:"LETTERS", voice:"Leon", model: process.env.OPENAI_MODEL || "gpt-4o" });
}
