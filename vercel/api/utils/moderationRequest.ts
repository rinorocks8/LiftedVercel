export async function moderationRequest(text: string): Promise<boolean> {
  const endpoint = "https://api.openai.com/v1/moderations";
  const apiKey = process.env.OpenAIKey as string;

  if (text.length > 2048)
    throw new Error("Text length exceeds the limit of 2048 characters");

  const options: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + apiKey
    },
    body: JSON.stringify({
      input: text,
    }),
  };

  try {
    const response = await fetch(endpoint, options);
    const data = await response.json();

    if (!response.ok) 
      throw new Error(`Error ${response.status}: ${data.Message ?? data.message}`);
    
    return data.results[0].flagged;
  } catch (error) {
    console.error(error);
    throw error;
  }
}
