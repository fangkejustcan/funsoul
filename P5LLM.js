// P5LLM Library v3.0 - Updated for PlayKit SDK integration
console.log("Loading P5LLM Library v3.0 - PlayKit SDK Integration");

// Load PlayKit SDK
function addPlayKitSDK() {
  let scriptTag = document.createElement("script");
  scriptTag.setAttribute("type", "text/javascript");
  scriptTag.src = "https://unpkg.com/playkit-sdk@latest/dist/playkit-sdk.umd.js";
  document.head.appendChild(scriptTag);
}

// Load axios for backward compatibility
function addAxios() {
  let scriptTag = document.createElement("script");
  scriptTag.setAttribute("type", "text/javascript");
  scriptTag.src = "https://fastly.jsdelivr.net/npm/axios/dist/axios.min.js";
  document.head.appendChild(scriptTag);
}

addPlayKitSDK();
addAxios();

// PlayKit SDK initialization
let playkitSDK = null;
let isPlayKitReady = false;

// Initialize PlayKit SDK
function initializePlayKit() {
  if (typeof PlayKitSDK !== 'undefined' && !playkitSDK) {
    playkitSDK = new PlayKitSDK.PlayKitSDK({
      gameId: '4d32e040-e4c8-49a6-80dd-be94aa9cf019',
      
    });

    playkitSDK.initialize().then(() => {
      console.log('PlayKit SDK initialized successfully!');
      isPlayKitReady = true;
    }).catch(error => {
      console.error('PlayKit SDK initialization failed:', error);
    });
  }
}

// Check if PlayKit SDK is loaded and initialize
function checkPlayKitReady() {
  if (typeof PlayKitSDK !== 'undefined' && !playkitSDK) {
    initializePlayKit();
  }
}

// Check every 100ms
setInterval(checkPlayKitReady, 100);

class P5LLM {
  messages = [];
  maxMessage = 16;
  systemPrompt = "";
  onComplete = null;
  onStream = null;
  onError = null;

  clearAllMessage() {
    this.messages = [];
  }

  setMaxMessage(max) {
    try {
      max = parseInt(max);
    } catch (error) {
      return;
    }
    this.maxMessage = max;
  }

  setSystemPrompt(systemPrompt) {
    this.systemPrompt = systemPrompt;
  }

  // Helper method to trim messages to maxMessage limit
  trimMessages() {
    if (this.maxMessage > 0 && this.messages.length > this.maxMessage) {
      // Remove oldest messages, keep the most recent ones
      this.messages.splice(0, this.messages.length - this.maxMessage);
    }
  }

  // 发送前包装
  preSend() {
    // Apply message limit (this will remove oldest messages if needed)
    this.trimMessages();

    let exactMessages = [
      {
        role: "system",
        content: this.systemPrompt,
      },
      ...this.messages,
    ];

    return exactMessages;
  }

  promptCheck(userPrompt) {
    if (typeof userPrompt === "string") {
      this.messages.push({
        role: "user",
        content: userPrompt,
      });
    } else {
      this.messages = [...this.messages, ...userPrompt];
    }
  }

  send(userPrompt, stream) {
    if (stream) {
      this.stream(userPrompt);
    } else {
      this.dialog(userPrompt);
    }
  }

  dialog(userPrompt) {
    this.promptCheck(userPrompt);
  }

  stream(userPrompt) {
    // 请根据不同模型重写
    this.promptCheck(userPrompt);
  }
}

class P5Spark extends P5LLM {
  model = "gpt-4.1-mini";
  appID = "cd769f96";
  chatClient = null;
  npcClient = null;

  constructor() {
    super();
    console.log("P5Spark initialized - using PlayKit SDK with gpt-4.1-mini");
    this.initializeChatClient();
  }

  async initializeChatClient() {
    // Wait for PlayKit SDK to be ready
    while (!isPlayKitReady) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
      this.chatClient = playkitSDK.createChatClient(this.model);
      console.log('P5Spark chat client created successfully');
    } catch (error) {
      console.error('Failed to create P5Spark chat client:', error);
    }
  }

  getNPCClient() {
    // Create NPC client with system prompt if it exists and is not empty
    if (!this.npcClient && this.systemPrompt && this.systemPrompt.trim() !== '') {
      this.npcClient = playkitSDK.createNPCClient({
        systemPrompt: this.systemPrompt,
        model: this.model  // Explicitly specify the model for NPC client
      });
      console.log(`P5Spark NPC client created with model: ${this.model} and system prompt: ${this.systemPrompt.substring(0, 50)}...`);
    }
    return this.npcClient;
  }

  Spark() {}

  setModel(model) {
    // For P5Spark, we always use gpt-4.1-mini as specified
    console.log(`P5Spark: Model set request ignored. Using ${this.model} as per specification.`);
  }

  generateRandomAPPID() {
    const min = 10000;
    const max = 99999;
    const randomFourDigitNumber =
      Math.floor(Math.random() * (max - min + 1)) + min;
    return randomFourDigitNumber.toString();
  }

  async send(userPrompt, stream) {
    if (stream) {
      await this.stream(userPrompt);
    } else {
      await this.dialog(userPrompt);
    }
  }

  async dialog(userPrompt) {
    super.dialog(userPrompt);

    // Wait for chat client to be ready
    while (!this.chatClient) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
      let content;

      // Use NPC client if system prompt is set, otherwise use regular chat client
      if (this.systemPrompt && this.systemPrompt.trim() !== '') {
        console.log(`P5Spark: Using NPC client with system prompt`);
        const npc = this.getNPCClient();

        if (!npc) {
          throw new Error('Failed to create NPC client');
        }

        content = await npc.talk(userPrompt);
        console.log(`P5Spark: NPC response: ${content.substring(0, 100)}...`);

        // When using NPC client, we maintain local messages array for compatibility
        // but the actual conversation history is managed by the NPC client
        this.messages.push({
          role: "assistant",
          content: content,
        });
      } else {
        console.log(`P5Spark: Using regular chat client (no system prompt)`);
        // For regular chat client, we need to manage message history manually
        // Apply message limit before sending
        this.trimMessages();

        content = await this.chatClient.chat(userPrompt);
        console.log(`P5Spark: Chat response: ${content.substring(0, 100)}...`);

        this.messages.push({
          role: "assistant",
          content: content,
        });
      }

      if (this.onComplete) {
        this.onComplete(content);
      }

      return content;
    } catch (error) {
      console.error('P5Spark dialog error:', error);
      if (this.onError) {
        this.onError(error);
      }
    }
  }

  async stream(userPrompt) {
    super.stream(userPrompt);

    // Wait for chat client to be ready
    while (!this.chatClient) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    let agent = this;
    let fullContent = "";

    try {
      // Use NPC client if system prompt is set, otherwise use regular chat client
      if (this.systemPrompt && this.systemPrompt.trim()) {
        const npc = this.getNPCClient();
        // Note: NPC client might not support streaming, fallback to regular chat
        const content = await npc.talk(userPrompt);
        fullContent = content;

        if (agent.onStream) {
          // Simulate streaming by sending the full content as one chunk
          agent.onStream(content);
        }

        agent.messages.push({
          role: "assistant",
          content: content,
        });

        if (agent.onComplete) {
          agent.onComplete(content);
        }
      } else {
        // Apply message limit before streaming
        this.trimMessages();

        await this.chatClient.chatStream(
          userPrompt,
          (chunk) => {
            if (agent.onStream) {
              agent.onStream(chunk);
              fullContent += chunk;
            }
          },
          (fullText) => {
            agent.messages.push({
              role: "assistant",
              content: fullText,
            });

            if (agent.onComplete) {
              agent.onComplete(fullText);
            }
          }
        );
      }
    } catch (error) {
      console.error(error);
      if (this.onError) {
        this.onError(error);
      }
    }
  }

  setSystemPrompt(systemPrompt) {
    super.setSystemPrompt(systemPrompt);
    // Reset NPC client when system prompt changes
    this.npcClient = null;
  }
}

class P5GLM extends P5LLM {
  model = "gpt-4.1-mini";
  temp = 0.5;
  chatClient = null;
  npcClient = null;

  constructor() {
    super();
    console.log("P5GLM initialized - using PlayKit SDK with gpt-4.1-mini model");
    this.initializeChatClient();
  }

  async initializeChatClient() {
    // Wait for PlayKit SDK to be ready
    while (!isPlayKitReady) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
      this.chatClient = playkitSDK.createChatClient(this.model);
      console.log('P5GLM chat client created successfully');
    } catch (error) {
      console.error('Failed to create P5GLM chat client:', error);
    }
  }

  getNPCClient() {
    // Create NPC client with system prompt if it exists and is not empty
    if (!this.npcClient && this.systemPrompt && this.systemPrompt.trim() !== '') {
      this.npcClient = playkitSDK.createNPCClient({
        systemPrompt: this.systemPrompt,
        model: this.model  // Explicitly specify the model for NPC client
      });
      console.log(`P5GLM NPC client created with model: ${this.model} and system prompt: ${this.systemPrompt.substring(0, 50)}...`);
    }
    return this.npcClient;
  }

  setModel(model) {
    // For P5GLM, we always use gpt-4.1-mini as specified
    console.log(`P5GLM: Model set request ignored. Using ${this.model} as per specification.`);
  }

  setTemperature(t) {
    this.temp = t;
  }

  async dialog(userPrompt) {
    super.dialog(userPrompt);

    // Wait for chat client to be ready
    while (!this.chatClient) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
      let content;

      // Use NPC client if system prompt is set, otherwise use regular chat client
      if (this.systemPrompt && this.systemPrompt.trim() !== '') {
        console.log(`P5GLM: Using NPC client with system prompt`);
        const npc = this.getNPCClient();

        if (!npc) {
          throw new Error('Failed to create NPC client');
        }

        content = await npc.talk(userPrompt);
        console.log(`P5GLM: NPC response: ${content.substring(0, 100)}...`);

        // When using NPC client, we maintain local messages array for compatibility
        // but the actual conversation history is managed by the NPC client
        this.messages.push({
          role: "assistant",
          content: content,
        });
      } else {
        console.log(`P5GLM: Using regular chat client (no system prompt)`);
        // For regular chat client, we need to manage message history manually
        // Apply message limit before sending
        this.trimMessages();

        content = await this.chatClient.chat(userPrompt);
        console.log(`P5GLM: Chat response: ${content.substring(0, 100)}...`);

        this.messages.push({
          role: "assistant",
          content: content,
        });
      }

      if (this.onComplete) {
        this.onComplete(content);
      }

      return content;
    } catch (error) {
      console.error(error);
      if (this.onError) {
        this.onError(error);
      }
    }
  }

  async stream(userPrompt) {
    super.stream(userPrompt);

    // Wait for chat client to be ready
    while (!this.chatClient) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    let agent = this;
    let fullContent = "";

    try {
      // Use NPC client if system prompt is set, otherwise use regular chat client
      if (this.systemPrompt && this.systemPrompt.trim()) {
        const npc = this.getNPCClient();
        // Note: NPC client might not support streaming, fallback to regular chat
        const content = await npc.talk(userPrompt);
        fullContent = content;

        if (agent.onStream) {
          // Simulate streaming by sending the full content as one chunk
          agent.onStream(content);
        }

        agent.messages.push({
          role: "assistant",
          content: content,
        });

        if (agent.onComplete) {
          agent.onComplete(content);
        }
      } else {
        await this.chatClient.chatStream(
          userPrompt,
          (chunk) => {
            if (agent.onStream) {
              agent.onStream(chunk);
              fullContent += chunk;
            }
          },
          (fullText) => {
            agent.messages.push({
              role: "assistant",
              content: fullText,
            });

            if (agent.onComplete) {
              agent.onComplete(fullText);
            }
          }
        );
      }
    } catch (error) {
      console.error(error);
      if (this.onError) {
        this.onError(error);
      }
    }
  }

  setSystemPrompt(systemPrompt) {
    super.setSystemPrompt(systemPrompt);
    // Reset NPC client when system prompt changes
    this.npcClient = null;
  }
}

class P5GLM4V extends P5LLM {
  model = "glm-4v";
  temp = 0.5;
  P5GLM() {}

  setModel(model) {
    // 目前只有一个模型
    this.model = model;
  }

  setTemperature(t) {
    this.temp = t;
  }

  promptCheck(userPrompt) {
    if (typeof userPrompt === "string") {
      // 正则表达式匹配以 'http:' 开头，以 '.jpg' 或 '.png' 结尾的 URL
      const imageRegex = /https?:\/\/[^\s]+\.(jpg|png)/i;
      let imageUrl = "";
      let remainingText = userPrompt;

      // 检查是否有匹配的 URL
      if (imageRegex.test(userPrompt)) {
        // 找到第一个匹配的 URL
        imageUrl = userPrompt.match(imageRegex)[0];
        // 移除 URL 部分，保留剩余的文本
        remainingText = userPrompt.replace(imageRegex, "");
      }

      // 构建新的消息对象
      const newMessage = {
        role: "user",
        content: [
          {
            type: "text",
            text: remainingText.trim(), // 去除可能的前后空格
          },
          {
            type: "image_url",
            image_url: {
              url: imageUrl,
            },
          },
        ],
      };

      // 推送新的消息对象到 messages 数组
      this.messages.push(newMessage);
    } else {
      this.messages = [...this.messages, ...userPrompt];
    }
    console.log(this.messages);
  }

  async dialog(userPrompt) {
    super.dialog(userPrompt);
    let sendMessages = this.preSend();
    console.log(sendMessages);
    let content;

    try {
      let res = await axios({
        method: "post",
        url: "https://morethanchat.club/server/dialogGLM",
        data: {
          model: this.model,
          messages: sendMessages,
        },
        temperature: this.temp,
      });

      console.log(res);
      content = res.data.choices[0].message.content;
      this.messages.push({
        role: "assistant",
        content: content,
      });

      if (this.onComplete) {
        this.onComplete(content);
      }

      return content;
    } catch (error) {
      console.error(error);
      if (this.onError) {
        this.onError(error);
      }
    }
  }

  async stream(userPrompt) {
    super.stream(userPrompt);
    let sendMessages = this.preSend();
    let agent = this;

    let toSend = {
      model: this.model,
      messages: sendMessages,
    };

    let fullContent = "";

    const socket = new WebSocket("wss://morethanchat.club/server/streamGLM");

    try {
      socket.onopen = function (event) {
        console.log("WebSocket连接已打开");
        socket.send(JSON.stringify(toSend));
      };
      socket.onmessage = function (event) {
        console.log(event.data);
        if (agent.onStream) {
          agent.onStream(event.data);
          fullContent += event.data;
        }
      };
      socket.onclose = function (event) {
        if (agent.onComplete) {
          agent.onComplete(fullContent);
        }
        console.log("WebSocket连接已关闭", event.code, event.reason);
      };
    } catch (error) {
      console.error(error);
      if (this.onError) {
        this.onError(error);
      }
    }
  }
}

class P5GPT extends P5LLM {
  model = "gpt-4o";
  chatClient = null;
  npcClient = null;

  constructor() {
    super();
    console.log("P5GPT initialized - using PlayKit SDK with gpt-4o model");
    this.initializeChatClient();
  }

  async initializeChatClient() {
    // Wait for PlayKit SDK to be ready
    while (!isPlayKitReady) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
      this.chatClient = playkitSDK.createChatClient(this.model);
      console.log('P5GPT chat client created successfully');
    } catch (error) {
      console.error('Failed to create P5GPT chat client:', error);
    }
  }

  getNPCClient() {
    // Create NPC client with system prompt if it exists and is not empty
    if (!this.npcClient && this.systemPrompt && this.systemPrompt.trim() !== '') {
      this.npcClient = playkitSDK.createNPCClient({
        systemPrompt: this.systemPrompt,
        model: this.model  // Explicitly specify the model for NPC client
      });
      console.log(`P5GPT NPC client created with model: ${this.model} and system prompt: ${this.systemPrompt.substring(0, 50)}...`);
    }
    return this.npcClient;
  }

  setModel(model) {
    // For P5GPT, we always use gpt-4o as specified
    console.log(`P5GPT: Model set request ignored. Using ${this.model} as per specification.`);
  }

  async embedding(input) {
    // Note: embedding functionality is not directly supported by PlayKit SDK
    // This method is kept for backward compatibility but may not work
    console.warn('P5GPT: embedding functionality is not supported by PlayKit SDK');
    try {
      let res = await axios({
        method: "post",
        url: "https://morethanchat.club/server/embeddingGPT",
        data: {
          input: input,
        },
      });

      let content = res.data["data"][0]["embedding"];

      if (this.onComplete) {
        this.onComplete(content);
      }

      return content;
    } catch (error) {
      console.error(error);
      if (this.onError) {
        this.onError(error);
      }
    }
  }

  async dialog(userPrompt) {
    super.dialog(userPrompt);

    // Wait for chat client to be ready
    while (!this.chatClient) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
      let content;

      // Use NPC client if system prompt is set, otherwise use regular chat client
      if (this.systemPrompt && this.systemPrompt.trim()) {
        const npc = this.getNPCClient();
        content = await npc.talk(userPrompt);
      } else {
        content = await this.chatClient.chat(userPrompt);
      }

      this.messages.push({
        role: "assistant",
        content: content,
      });

      if (this.onComplete) {
        this.onComplete(content);
      }

      return content;
    } catch (error) {
      console.error(error);
      if (this.onError) {
        this.onError(error);
      }
    }
  }

  async stream(userPrompt) {
    super.stream(userPrompt);

    // Wait for chat client to be ready
    while (!this.chatClient) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    let agent = this;
    let fullContent = "";

    try {
      // Use NPC client if system prompt is set, otherwise use regular chat client
      if (this.systemPrompt && this.systemPrompt.trim()) {
        const npc = this.getNPCClient();
        // Note: NPC client might not support streaming, fallback to regular chat
        const content = await npc.talk(userPrompt);
        fullContent = content;

        if (agent.onStream) {
          // Simulate streaming by sending the full content as one chunk
          agent.onStream(content);
        }

        agent.messages.push({
          role: "assistant",
          content: content,
        });

        if (agent.onComplete) {
          agent.onComplete(content);
        }
      } else {
        await this.chatClient.chatStream(
          userPrompt,
          (chunk) => {
            if (agent.onStream) {
              agent.onStream(chunk);
              fullContent += chunk;
            }
          },
          (fullText) => {
            agent.messages.push({
              role: "assistant",
              content: fullText,
            });

            if (agent.onComplete) {
              agent.onComplete(fullText);
            }
          }
        );
      }
    } catch (error) {
      console.error(error);
      if (this.onError) {
        this.onError(error);
      }
    }
  }

  setSystemPrompt(systemPrompt) {
    super.setSystemPrompt(systemPrompt);
    // Reset NPC client when system prompt changes
    this.npcClient = null;
  }
}

class P5Dify extends P5LLM {
  constructor() {
    super();
    this.apiKey = ""; // API密钥
    this.url = ""; // 动态设置的API URL
    this.proxyUrl = "https://morethanchat.club/server/dialogDIFY"; // 后端代理的URL
    this.data = {
      query: "", // 用户问题
      inputs: {}, // 自定义输入
      conversation_id: "", // 保留已有的 conversation_id
      response_mode: "blocking", // 阻塞模式
      user: this.user || "default_user", // 默认用户标识
    };
  }

  // 设置DIFY API URL
  setUrl(url) {
    this.url = url;
  }

  // 设置API密钥
  setKey(key) {
    this.apiKey = key;
  }

  clearAllMessage() {
    this.messages = [];
    this.data.conversation_id = "";
  }
  // 发送请求并返回响应数据

  dialog(userInput) {
    this.data.query = userInput;
    super.dialog(userInput);

    return new Promise(async (resolve, reject) => {
      // 构造发往后端的请求体
      const requestData = {
        url: this.url, // DIFY API 的 URL
        key: this.apiKey, // API 密钥
        request: this.data, // 请求体
      };

      try {
        // 通过后端代理发送请求并返回结果
        let response = await axios({
          method: "post",
          url: this.proxyUrl, // 发送到后端代理接口
          headers: {
            "Content-Type": "application/json",
          },
          data: requestData, // 将封装好的数据发送到后端
        });

        // 处理响应数据
        const data = response.data; // 获取后端返回的数据

        if (data?.data?.outputs) {
          let result = data.data.outputs.text || "No result found"; // 提取 text 字段
          resolve(result); // 返回结果
        } else if (data && data.answer) {
          // 保存 conversation_id 以便后续请求继续对话
          if (data.conversation_id) {
            this.data.conversation_id = data.conversation_id;
          }

          let content = data.answer;

          this.messages.push({
            role: "assistant",
            content: content,
          });

          if (this.onComplete) {
            this.onComplete(content);
          }

          resolve(data.answer); // 处理聊天助手 API 响应
        } else {
          resolve("No outputs received"); // 默认情况
        }
      } catch (error) {
        // 捕获错误并返回错误信息
        console.error(
          "Error:",
          error.response ? error.response.data : error.message
        );
        reject(error); // 使用 Promise 返回错误
      }
    });
  }
}

class P5DeepSeek extends P5LLM {
  model = "deepseek-chat";
  temperature = 0.7;
  maxTokens = 4096;
  chatClient = null;
  npcClient = null;

  constructor() {
    super();
    console.log("P5DeepSeek initialized - using PlayKit SDK with deepseek-chat model");
    this.initializeChatClient();
  }

  async initializeChatClient() {
    // Wait for PlayKit SDK to be ready
    while (!isPlayKitReady) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
      this.chatClient = playkitSDK.createChatClient(this.model);
      console.log('P5DeepSeek chat client created successfully');
    } catch (error) {
      console.error('Failed to create P5DeepSeek chat client:', error);
    }
  }

  getNPCClient() {
    // Create NPC client with system prompt if it exists and is not empty
    if (!this.npcClient && this.systemPrompt && this.systemPrompt.trim() !== '') {
      this.npcClient = playkitSDK.createNPCClient({
        systemPrompt: this.systemPrompt,
        model: this.model  // Explicitly specify the model for NPC client
      });
      console.log(`P5DeepSeek NPC client created with model: ${this.model} and system prompt: ${this.systemPrompt.substring(0, 50)}...`);
    }
    return this.npcClient;
  }

  setModel(model) {
    // For P5DeepSeek, we always use deepseek-chat as specified
    console.log(`P5DeepSeek: Model set request ignored. Using ${this.model} as per specification.`);
  }

  setTemperature(temp) {
    this.temperature = temp;
  }

  setMaxTokens(tokens) {
    this.maxTokens = tokens;
  }

  setApiKey(key) {
    // API key is handled by PlayKit SDK, this method is kept for backward compatibility
    console.warn('P5DeepSeek: setApiKey is not needed when using PlayKit SDK');
  }

  async dialog(userPrompt) {
    super.dialog(userPrompt);

    // Wait for chat client to be ready
    while (!this.chatClient) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
      let content;

      // Use NPC client if system prompt is set, otherwise use regular chat client
      if (this.systemPrompt && this.systemPrompt.trim()) {
        const npc = this.getNPCClient();
        content = await npc.talk(userPrompt);
      } else {
        content = await this.chatClient.chat(userPrompt);
      }

      this.messages.push({
        role: "assistant",
        content: content,
      });

      if (this.onComplete) {
        this.onComplete(content);
      }

      return content;
    } catch (error) {
      console.error(error);
      if (this.onError) {
        this.onError(error);
      }
    }
  }

  async stream(userPrompt) {
    super.stream(userPrompt);

    // Wait for chat client to be ready
    while (!this.chatClient) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    let agent = this;
    let fullContent = "";

    try {
      // Use NPC client if system prompt is set, otherwise use regular chat client
      if (this.systemPrompt && this.systemPrompt.trim()) {
        const npc = this.getNPCClient();
        // Note: NPC client might not support streaming, fallback to regular chat
        const content = await npc.talk(userPrompt);
        fullContent = content;

        if (agent.onStream) {
          // Simulate streaming by sending the full content as one chunk
          agent.onStream(content);
        }

        agent.messages.push({
          role: "assistant",
          content: content,
        });

        if (agent.onComplete) {
          agent.onComplete(content);
        }
      } else {
        await this.chatClient.chatStream(
          userPrompt,
          (chunk) => {
            if (agent.onStream) {
              agent.onStream(chunk);
              fullContent += chunk;
            }
          },
          (fullText) => {
            agent.messages.push({
              role: "assistant",
              content: fullText,
            });

            if (agent.onComplete) {
              agent.onComplete(fullText);
            }
          }
        );
      }
    } catch (error) {
      console.error(error);
      if (this.onError) {
        this.onError(error);
      }
    }
  }

  setSystemPrompt(systemPrompt) {
    super.setSystemPrompt(systemPrompt);
    // Reset NPC client when system prompt changes
    this.npcClient = null;
  }
}
