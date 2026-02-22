import { NextResponse } from 'next/server';

export async function GET() {
  const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
  
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant', // Fastest & lightest model
        messages: [
          {
            role: 'user',
            content: 'Say "MCP Test Successful! Hello from Groq API!" in exactly those words.'
          }
        ],
        max_tokens: 50,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      return NextResponse.json(
        { 
          success: false, 
          error: `Groq API Error: ${response.status}`,
          details: errorData 
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      message: 'MCP and Groq API are working correctly!',
      model: data.model,
      response: data.choices?.[0]?.message?.content || 'No response',
      usage: data.usage,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

