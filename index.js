import express from 'express'

import path from "path";

import { fileURLToPath } from "url";

import cors from "cors"

import "dotenv/config";

import { StringOutputParser } from "@langchain/core/output_parsers";

import { StateGraph, MessagesAnnotation, MemorySaver} from '@langchain/langgraph';

import { ChatGroq } from '@langchain/groq';

import {ToolNode} from "@langchain/langgraph/prebuilt"

import{TavilySearch} from "@langchain/tavily"

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const app1 = express()

app1.use(express.json());

app1.use(express.static(path.join(__dirname, "public")));

app1.use(cors())

const checkpointer = new MemorySaver()

const tool = new TavilySearch({
    maxResults:1,
    topiv:'general',
    apiKey : process.env.TAVILY_API_KEY
})

const tools = [tool]

const toolNode = new ToolNode(tools)

const llm = new ChatGroq({
    model:"openai/gpt-oss-120b", //llama-3.1-8b-instant openai/gpt-oss-120b
    apiKey:process.env.GROQ_API_KEY,
    temperature:0,
    maxRetries:2,
}).bindTools(tools)

async function callModel(state) {
  // Return only the update; here we add a fake assistant reply
console.log("llm Called")

 const response = await llm.invoke(state.messages);

  return {
    messages: [response]};
  
}
function shouldContinue(state) {

     const lastMessage = state.messages[state.messages.length-1]
     if(lastMessage.tool_calls.length > 0)
     {
        return 'tools'
     }

     return '__end__'

}

const workflow = new StateGraph(MessagesAnnotation)
  .addNode('agent', callModel)
  .addNode('tools',toolNode)
  .addEdge('__start__', 'agent')
  .addEdge('tools', 'agent')
  .addConditionalEdges("agent",shouldContinue);

const app = workflow.compile(checkpointer);//{checkpointer}

async function main() {

    const parser = new StringOutputParser();

    app1.post('/api/submit',async (req,res)=>{

    const finalState = await app.invoke({

      messages: [{ role: 'user', content: req.body.question }],

    }, {cofigurable : {thread_id : "1"} } ); //{cofigurable : {thread_id:"1" } }

    const lastMessage = finalState.messages[finalState.messages.length-1]

    console.log('Final:', lastMessage.content);

    res.send({received:lastMessage.content});

    } )
 
  }

main();

app1.listen(8000,()=>{
    console.log("sever atarted at port 8000")
})

//@langcgain/community