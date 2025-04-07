// index.js

const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');

const app = express();
const port = process.env.PORT || 3000;

let qrCodeDataUrl = null; // Armazena a Data URL do QR Code gerado
let qrPrinted = false;    // Flag para garantir que o QR Code seja gerado apenas uma vez

// Rota principal para indicar que o bot está ativo
app.get('/', (req, res) => {
  res.send('Bot está rodando! Para visualizar o QR Code, acesse /qr');
});

// Rota para exibir o QR Code como imagem
app.get('/qr', (req, res) => {
  if (qrCodeDataUrl) {
    res.send(`
      <html>
        <head>
          <title>QR Code do Bot</title>
        </head>
        <body style="text-align: center; font-family: Arial, sans-serif;">
          <h1>QR Code do Bot</h1>
          <img src="${qrCodeDataUrl}" alt="QR Code" style="max-width: 100%; height: auto;"/>
          <p>Escaneie com o WhatsApp.</p>
        </body>
      </html>
    `);
  } else {
    res.send('QR Code ainda não foi gerado. Aguarde...');
  }
});

// Inicia o servidor web para manter o container ativo
app.listen(port, () => {
  console.log(`Servidor web rodando na porta ${port}`);
});

//
// Funções e variáveis para gerenciar conversas
//

// Map para armazenar o estado de cada conversa (cada usuário)
const conversations = new Map();

// Map para armazenar usuários bloqueados até uma certa data/hora (chave: msg.from, valor: data/hora de desbloqueio)
const lockedUsers = new Map();

function getConversation(from) {
  if (!conversations.has(from)) {
    conversations.set(from, {
      currentState: 'waitingForGreeting',
      warningTimer: null,
      finalTimer: null,
      warningSent: false,
      selectedPartner: '',
      notaFiscal: '',
      name: '',
      financeiroOption: '',
      logisticaOption: '',
      parcela: '',
      motivo: ''
    });
  }
  return conversations.get(from);
}

// Função para resetar os timers de inatividade (somente se o atendimento não estiver finalizado)
function resetInactivityTimers(conversation, from, msg) {
  if (conversation.warningTimer) {
    clearTimeout(conversation.warningTimer);
  }
  if (conversation.finalTimer) {
    clearTimeout(conversation.finalTimer);
  }
  conversation.warningSent = false;
  conversation.warningTimer = setTimeout(() => {
    sendReply(msg, "Oi, ainda está aí?");
    conversation.warningSent = true;
  }, 5 * 60 * 1000);

  conversation.finalTimer = setTimeout(() => {
    sendReply(msg, "A FULLMAC agradece o contato.");
    const now = new Date();
    const lockUntil = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    lockedUsers.set(from, lockUntil);
    conversations.delete(from);
    console.log(`Usuário ${from} finalizado por inatividade e bloqueado até ${lockUntil.toLocaleTimeString()}.`);
  }, 7 * 60 * 1000);
}

// Função para cancelar os timers e finalizar o atendimento
function finalizeConversation(msg, conversation) {
  if (conversation.warningTimer) {
    clearTimeout(conversation.warningTimer);
    conversation.warningTimer = null;
  }
  if (conversation.finalTimer) {
    clearTimeout(conversation.finalTimer);
    conversation.finalTimer = null;
  }
  conversation.currentState = "finalizado";
}

// Função para verificar se o usuário está bloqueado
function isUserLocked(from) {
  if (lockedUsers.has(from)) {
    const lockUntil = lockedUsers.get(from);
    const now = new Date();
    if (now < lockUntil) {
      return true;
    } else {
      lockedUsers.delete(from);
      return false;
    }
  }
  return false;
}

function sendReply(msg, text) {
  msg.reply(text);
}

// Função para encaminhamento no fluxo financeiro:
function encaminharParaAnalista(msg, conversation) {
  const analistaNumero = '5511999939547';
  const analistaLink = `https://wa.me/${analistaNumero}`;
  const info = `Encaminhamento de atendimento (Financeiro):
Nome: ${conversation.name || 'N/A'}
${conversation.financeiroOption ? `Opção: ${conversation.selectedPartner} - ${conversation.financeiroOption}` : ''}
${conversation.parcela ? `Parcela: ${conversation.parcela}` : ''}
${conversation.motivo ? `Motivo: ${conversation.motivo}` : ''}
Documento: ${conversation.notaFiscal || 'N/A'}
Contato: ${msg.from.replace('@c.us', '')}
Número do Analista: ${analistaLink}`;
  
  client.sendMessage(`${analistaNumero}@c.us`, info);
  sendReply(msg, "Seu atendimento foi registrado, agora é só aguardar por gentileza que um analista entrará em contato.");
}

// Função para encaminhamento no fluxo de logística:
function enviarFinalizacaoLogistica(msg, conversation) {
  const analistaNumero = '5511999939547';
  const analistaLink = `https://wa.me/${analistaNumero}`;
  const info = `Encaminhamento de atendimento (Logística):
Nome: ${conversation.name || 'N/A'}
Opção: Logística - ${conversation.logisticaOption}
Documento: ${conversation.notaFiscal || 'N/A'}
Contato: ${msg.from.replace('@c.us', '')}
Número do Analista: ${analistaLink}`;
  
  client.sendMessage(`${analistaNumero}@c.us`, info);
  sendReply(msg, "Seu atendimento foi registrado, agora é só aguardar por gentileza que um analista entrará em contato.");
}

// ======= Funções para exibir menus =======

function showGreetingMenu(msg, conversation) {
  sendReply(msg, `
Olá, seja bem-vindo à FULLMAC!

Para iniciarmos, por favor, informe seu nome:
Ou digite SAIR para encerrar o atendimento.`);
  conversation.currentState = 'waitingForName';
}

function showMainMenu(msg, conversation) {
  sendReply(msg, `
Muito obrigado, ${conversation.name}!
A FULLMAC agradece o contato 😁

Conheça nossos produtos e fale com um distribuidor parceiro.

A seguir, digite a opção desejada:

1 - Parceiros Comerciais🤝
2 - Financeiro 💶
3 - Logística 🛒🚚

---------------------------------------------------
Para retornar ao menu principal a qualquer momento, digite: 0
Ou digite SAIR para encerrar o atendimento.`);
  conversation.currentState = 'mainMenu';
}

function showParceirosComerciais(msg, conversation) {
  sendReply(msg, `
Você selecionou Parceiros Comerciais

Digite a opção desejada:

1 - ASAP EMBALAGENS
   Freguesia do Ó - SP
   Link: https://www.asapembalagens.com.br
   WhatsApp: https://wa.me/5511917131144

2 - BELLA CAMP
   Campinas - SP
   Link: https://www.bellacamp.com.br
   WhatsApp: https://wa.me/551931994838

3 - LIMEIRA PACK
   Cordeirópolis - SP
   Link: https://www.limeirapack.com.br
   WhatsApp: https://wa.me/551931850752

4 - MB PACK
   Vargem Grande Paulista - SP
   Link: https://www.mbpack.com.br
   WhatsApp: https://wa.me/551147775074

5 - MBB EMBALAGENS
   Vargem Grande Paulista - SP
   Link: https://www.mbbembalagens.com.br
   WhatsApp: https://wa.me/551145518516

6 - MMA PACK
   Sorocaba - SP
   Link: https://www.mmapack.com.br
   WhatsApp: https://wa.me/551133188485

7 - RIBEIRAO PACK
   Ribeirão Preto - SP
   Link: https://www.rineiraopack.com.br
   WhatsApp: https://wa.me/55111636000421

8 - VG PACK
   Cotia - SP
   Link: https://www.vgpack.com.br
   WhatsApp: https://wa.me/551142436681

---------------------------------------------------
Para retornar ao menu principal, digite: 0
Ou digite SAIR para encerrar o atendimento.`);
  conversation.currentState = 'parceirosComerciais';
}

function showFinanceiroPartnerSelection(msg, conversation) {
  sendReply(msg, `
Informe por gentileza o número correspondente do Parceiro:

1 - ASAP EMBALAGENS
2 - BELLA CAMP
3 - LIMEIRA PACK
4 - MB PACK
5 - MBB EMBALAGENS
6 - MMA PACK
7 - RIBEIRAO PACK
8 - VG PACK

---------------------------------------------------
Para retornar ao menu principal, digite: 0
Ou digite SAIR para encerrar o atendimento.`);
  conversation.currentState = 'financeiroSelectPartner';
}

function showFinanceiroSubmenu(msg, conversation, partnerName) {
  sendReply(msg, `
Você selecionou ${partnerName} no Financeiro.

1 - Cobrança Indevida
2 - Negociação de Boleto Vencido
3 - 2ª via de boleto
4 - Cancelamento de boleto
5 - Prorrogação de boleto
6 - Débitos Pendentes
7 - Outros Assuntos

---------------------------------------------------
Para retornar ao menu principal, digite: 0
Ou digite SAIR para encerrar o atendimento.`);
  conversation.currentState = 'financeiroSubmenu';
}

function showLogisticaMenu(msg, conversation) {
  conversation.financeiroOption = '';
  sendReply(msg, `
Para consultar o andamento da entrega do seu pedido, por favor escolha uma das opções abaixo:
Digite o número correspondente à opção desejada:
1 - Nota Fiscal
2 - Número do Pedido

---------------------------------------------------
Para retornar ao menu principal, digite: 0
Ou digite SAIR para encerrar o atendimento.`);
  conversation.currentState = 'logisticaMenu';
}

function showLogisticaInputNota(msg, conversation) {
  sendReply(msg, `
Por favor, insira o Número da Nota Fiscal:
Ou digite SAIR para encerrar o atendimento.`);
  conversation.currentState = 'logisticaInputNota';
}

function showLogisticaInputPedido(msg, conversation) {
  sendReply(msg, `
Por favor, insira o Número do Pedido:
Ou digite SAIR para encerrar o atendimento.`);
  conversation.currentState = 'logisticaInputPedido';
}

function showLogisticaPartnerSelection(msg, conversation) {
  sendReply(msg, `
Informe por gentileza o número correspondente do Parceiro:

1 - ASAP EMBALAGENS
2 - BELLA CAMP
3 - LIMEIRA PACK
4 - MB PACK
5 - MBB EMBALAGENS
6 - MMA PACK
7 - RIBEIRAO PACK
8 - VG PACK

---------------------------------------------------
Para retornar ao menu principal, digite: 0
Ou digite SAIR para encerrar o atendimento.`);
  conversation.currentState = 'logisticaSelectPartner';
}

function handleDefault(msg) {
  sendReply(msg, "Desculpe, não entendi! Se houver qualquer dúvida além das opções disponibilizadas no menu, entre em contato através do número 11 99994-5268 ou contato@fullmac.com.br\nA FULLMAC agradece seu contato.✌️");
}

const greetingKeywords = [
  "oi", "oie", "oiie", "olá", "ola", "boa tarde", "bom dia", "boa noite", "e ae", "blz", "como vai", "ola tudo bem", "hei", "hey", "oi tudo bem"
];

function processInput(input, conversation, msg) {
  const text = input.trim();
  const lowerText = text.toLowerCase();
  const confirmations = ["ok", "obrigado", "valeu", "ta bom", "certo", "perfeito", "ótimo"];

  // Verifica se o usuário deseja encerrar o atendimento
  if (lowerText === "sair") {
    sendReply(msg, "A FULLMAC agradece o contato.");
    conversations.delete(msg.from);
    return;
  }

  if (isUserLocked(msg.from)) {
    return;
  }

  if (conversation.warningSent) {
    const resumeWords = ["sim", "claro", "ok"];
    if (resumeWords.includes(lowerText)) {
      if (conversation.finalTimer) clearTimeout(conversation.finalTimer);
      conversation.warningSent = false;
      sendReply(msg, "Atendimento retomado.");
      return;
    } else {
      sendReply(msg, "Para retomar o atendimento, por favor responda com 'sim', 'claro' ou 'ok'.");
      return;
    }
  }

  if (text === "0") {
    if (conversation.name && conversation.name.length > 0) {
      showMainMenu(msg, conversation);
    } else {
      showGreetingMenu(msg, conversation);
    }
    return;
  }

  if (conversation.currentState === "waitingForName") {
    conversation.name = text;
    showMainMenu(msg, conversation);
    return;
  }

  switch (conversation.currentState) {
    case 'waitingForGreeting': {
      const isGreeting = greetingKeywords.some(keyword => lowerText.includes(keyword));
      if (isGreeting) {
        showGreetingMenu(msg, conversation);
      } else {
        handleDefault(msg);
      }
      break;
    }
    case 'mainMenu': {
      if (text === "1") {
        showParceirosComerciais(msg, conversation);
      } else if (text === "2") {
        showFinanceiroPartnerSelection(msg, conversation);
      } else if (text === "3") {
        showLogisticaMenu(msg, conversation);
      } else if (confirmations.some(word => lowerText.includes(word))) {
        sendReply(msg, "😉");
      } else {
        handleDefault(msg);
      }
      break;
    }
    case 'parceirosComerciais': {
      const parceiros = {
        "1": "ASAP EMBALAGENS",
        "2": "BELLA CAMP",
        "3": "LIMEIRA PACK",
        "4": "MB PACK",
        "5": "MBB EMBALAGENS",
        "6": "MMA PACK",
        "7": "RIBEIRAO PACK",
        "8": "VG PACK"
      };
      if (parceiros[text]) {
        sendReply(msg, `Você selecionou ${parceiros[text]}.
Para acessar o site, clique no link e, para falar via WhatsApp, utilize o link disponibilizado.
---------------------------------------------------
Para retornar ao menu principal, digite: 0
Ou digite SAIR para encerrar o atendimento.`);
      } else if (confirmations.some(word => lowerText.includes(word))) {
        sendReply(msg, "😉");
      } else {
        handleDefault(msg);
      }
      break;
    }
    case 'financeiroSelectPartner': {
      const parceirosFinanceiro = {
        "1": "ASAP EMBALAGENS",
        "2": "BELLA CAMP",
        "3": "LIMEIRA PACK",
        "4": "MB PACK",
        "5": "MBB EMBALAGENS",
        "6": "MMA PACK",
        "7": "RIBEIRAO PACK",
        "8": "VG PACK"
      };
      if (parceirosFinanceiro[text]) {
        conversation.selectedPartner = parceirosFinanceiro[text];
        showFinanceiroSubmenu(msg, conversation, conversation.selectedPartner);
      } else if (confirmations.some(word => lowerText.includes(word))) {
        sendReply(msg, "😉");
      } else {
        sendReply(msg, "Desculpe, não entendi! Informe o número do parceiro por gentileza.");
      }
      break;
    }
    case 'financeiroSubmenu': {
      switch(text) {
        case "1":
          conversation.financeiroOption = "Cobrança Indevida";
          sendReply(msg, "Informe o número da Nota Fiscal:");
          conversation.currentState = "financeiro_cobranca_indevida_nota";
          break;
        case "2":
          conversation.financeiroOption = "Negociação de Boleto Vencido";
          sendReply(msg, "Informe o número da Nota Fiscal:");
          conversation.currentState = "financeiro_negociacao_nota";
          break;
        case "3":
          conversation.financeiroOption = "2ª via de boleto";
          sendReply(msg, "Informe o número da Nota Fiscal:");
          conversation.currentState = "financeiro_2via_nota";
          break;
        case "4":
          conversation.financeiroOption = "Cancelamento de boleto";
          sendReply(msg, "Informe o número da Nota Fiscal:");
          conversation.currentState = "financeiro_cancelamento_nota";
          break;
        case "5":
          conversation.financeiroOption = "Prorrogação de boleto";
          sendReply(msg, "Informe o número da Nota Fiscal:");
          conversation.currentState = "financeiro_prorrogacao_nota";
          break;
        case "6":
          conversation.financeiroOption = "Débitos Pendentes";
          sendReply(msg, "Informe por gentileza o número da Nota Fiscal ou CNPJ (até 14 dígitos):");
          conversation.currentState = "financeiro_debitos_nota";
          break;
        case "7":
          conversation.financeiroOption = "Outros Assuntos";
          encaminharParaAnalista(msg, conversation);
          finalizeConversation(msg, conversation);
          break;
        default:
          handleDefault(msg);
      }
      break;
    }
    case 'financeiro_cobranca_indevida_nota': {
      if (/^\d{1,6}$/.test(text)) {
        conversation.notaFiscal = text;
        encaminharParaAnalista(msg, conversation);
        finalizeConversation(msg, conversation);
      } else {
        sendReply(msg, "Por favor, informe um número de Nota Fiscal válido (até 6 dígitos).");
      }
      break;
    }
    case 'financeiro_negociacao_nota': {
      if (/^\d{1,6}$/.test(text)) {
        conversation.notaFiscal = text;
        sendReply(msg, "Agora, informe a parcela (2 dígitos):");
        conversation.currentState = "financeiro_negociacao_parcela";
      } else {
        sendReply(msg, "Por favor, informe um número de Nota Fiscal válido (até 6 dígitos).");
      }
      break;
    }
    case 'financeiro_negociacao_parcela': {
      if (/^\d{2}$/.test(text)) {
        conversation.parcela = text;
        sendReply(msg, "Qual motivo da prorrogação (máximo 500 caracteres):");
        conversation.currentState = "financeiro_negociacao_motivo";
      } else {
        sendReply(msg, "Por favor, informe uma parcela válida (2 dígitos).");
      }
      break;
    }
    case 'financeiro_negociacao_motivo': {
      if (text.length <= 500) {
        conversation.motivo = text;
        encaminharParaAnalista(msg, conversation);
        finalizeConversation(msg, conversation);
      } else {
        sendReply(msg, "Por favor, limite sua resposta a 500 caracteres.");
      }
      break;
    }
    case 'financeiro_2via_nota': {
      if (/^\d{1,6}$/.test(text)) {
        conversation.notaFiscal = text;
        sendReply(msg, "Qual a Parcela? (2 dígitos):");
        conversation.currentState = "financeiro_2via_parcela";
      } else {
        sendReply(msg, "Por favor, informe um número de Nota Fiscal válido (até 6 dígitos).");
      }
      break;
    }
    case 'financeiro_2via_parcela': {
      if (/^\d{2}$/.test(text)) {
        conversation.parcela = text;
        encaminharParaAnalista(msg, conversation);
        finalizeConversation(msg, conversation);
      } else {
        sendReply(msg, "Por favor, informe uma parcela válida (2 dígitos).");
      }
      break;
    }
    case 'financeiro_cancelamento_nota': {
      if (/^\d{1,6}$/.test(text)) {
        conversation.notaFiscal = text;
        sendReply(msg, "Qual Parcela? (2 dígitos):");
        conversation.currentState = "financeiro_cancelamento_parcela";
      } else {
        sendReply(msg, "Por favor, informe um número de Nota Fiscal válido (até 6 dígitos).");
      }
      break;
    }
    case 'financeiro_cancelamento_parcela': {
      if (/^\d{2}$/.test(text)) {
        conversation.parcela = text;
        encaminharParaAnalista(msg, conversation);
        finalizeConversation(msg, conversation);
      } else {
        sendReply(msg, "Por favor, informe uma parcela válida (2 dígitos).");
      }
      break;
    }
    case 'financeiro_prorrogacao_nota': {
      if (/^\d{1,6}$/.test(text)) {
        conversation.notaFiscal = text;
        sendReply(msg, "Qual a Parcela? (2 dígitos):");
        conversation.currentState = "financeiro_prorrogacao_parcela";
      } else {
        sendReply(msg, "Por favor, informe um número de Nota Fiscal válido (até 6 dígitos).");
      }
      break;
    }
    case 'financeiro_prorrogacao_parcela': {
      if (/^\d{2}$/.test(text)) {
        conversation.parcela = text;
        sendReply(msg, "Perfeito, agora me explique por gentileza o motivo (máximo 500 caracteres):");
        conversation.currentState = "financeiro_prorrogacao_motivo";
      } else {
        sendReply(msg, "Por favor, informe uma parcela válida (2 dígitos).");
      }
      break;
    }
    case 'financeiro_prorrogacao_motivo': {
      if (text.length <= 500) {
        conversation.motivo = text;
        encaminharParaAnalista(msg, conversation);
        finalizeConversation(msg, conversation);
      } else {
        sendReply(msg, "Por favor, limite sua resposta a 500 caracteres.");
      }
      break;
    }
    case 'financeiro_debitos_nota': {
      if (/^\d{1,14}$/.test(text)) {
        conversation.notaFiscal = text;
        encaminharParaAnalista(msg, conversation);
        finalizeConversation(msg, conversation);
      } else {
        sendReply(msg, "Por favor, informe um número válido (até 14 dígitos).");
      }
      break;
    }
    case 'financeiro_outros': {
      encaminharParaAnalista(msg, conversation);
      finalizeConversation(msg, conversation);
      break;
    }
    case 'logisticaMenu': {
      if (text === "1") {
        conversation.logisticaOption = "Nota Fiscal";
        showLogisticaInputNota(msg, conversation);
      } else if (text === "2") {
        conversation.logisticaOption = "Número do Pedido";
        showLogisticaInputPedido(msg, conversation);
      } else if (confirmations.some(word => lowerText.includes(word))) {
        sendReply(msg, "😉");
      } else {
        handleDefault(msg);
      }
      break;
    }
    case 'logisticaInputNota': {
      if (/^\d{1,6}$/.test(text)) {
        conversation.notaFiscal = text;
        sendReply(msg, `Número da Nota Fiscal recebido: ${conversation.notaFiscal}`);
        showLogisticaPartnerSelection(msg, conversation);
      } else {
        sendReply(msg, "Por favor, informe um número de Nota Fiscal válido (até 6 dígitos).");
      }
      break;
    }
    case 'logisticaInputPedido': {
      if (/^\d{1,6}$/.test(text)) {
        conversation.notaFiscal = text;
        sendReply(msg, `Número do Pedido recebido: ${conversation.notaFiscal}`);
        showLogisticaPartnerSelection(msg, conversation);
      } else {
        sendReply(msg, "Por favor, informe um número de Pedido válido (até 6 dígitos).");
      }
      break;
    }
    case 'logisticaSelectPartner': {
      const parceirosLogistica = {
        "1": "ASAP EMBALAGENS",
        "2": "BELLA CAMP",
        "3": "LIMEIRA PACK",
        "4": "MB PACK",
        "5": "MBB EMBALAGENS",
        "6": "MMA PACK",
        "7": "RIBEIRAO PACK",
        "8": "VG PACK"
      };
      if (parceirosLogistica[text]) {
        conversation.selectedPartner = parceirosLogistica[text];
        enviarFinalizacaoLogistica(msg, conversation);
        finalizeConversation(msg, conversation);
      } else if (confirmations.some(word => lowerText.includes(word))) {
        sendReply(msg, "😉");
      } else {
        handleDefault(msg);
      }
      break;
    }
    case 'logisticaConfirmation': {
      if (confirmations.some(word => lowerText.includes(word))) {
        sendReply(msg, "😉");
      } else {
        handleDefault(msg);
      }
      break;
    }
    default: {
      handleDefault(msg);
    }
  }
  
  // Se o atendimento ainda não foi finalizado, reinicia os timers de inatividade
  if (conversation.currentState !== "finalizado") {
    resetInactivityTimers(conversation, msg.from, msg);
  }
}

//
// Inicializa o Client do WhatsApp
//
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

// Evento para quando o QR Code for gerado: converte em Data URL para exibir na rota /qr
client.on('qr', (qr) => {
  if (!qrPrinted) {
    QRCode.toDataURL(qr, (err, url) => {
      if (err) {
        console.error('Erro ao gerar QR Code:', err);
      } else {
        qrCodeDataUrl = url;
        console.log('QR Code gerado. Acesse /qr para visualizá-lo.');
      }
    });
    qrPrinted = true;
  }
});

client.on('authenticated', () => {
  console.log('Cliente autenticado com sucesso!');
});

client.on('auth_failure', () => {
  console.log('Falha na autenticação, tentando novamente...');
  qrPrinted = false;
});

client.on('ready', () => {
  console.log('Cliente WhatsApp pronto!');
});

client.on('message', (msg) => {
  if (isUserLocked(msg.from)) {
    return;
  }
  const conversation = getConversation(msg.from);
  processInput(msg.body, conversation, msg);
});

client.initialize();
