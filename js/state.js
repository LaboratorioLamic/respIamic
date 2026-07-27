// Estado global da aplicação

// ESTADO DA APLICAÇÃO
let appointments = [];
let pendingChecklistAction = null;

// MIGRAR DADOS ANTIGOS PARA NOVA ESTRUTURA DE STATUS
appointments = appointments.map(app => {
    if(!app.status) {
        app.status = app.chkConcluido ? 'Concluído' : 'Agendado';
    }
    return app;
});

let atendentesList = [];
let motivosPerdaList = [];
let currentDate = new Date();

// Visão do calendário: 'month' (padrão) ou 'week'
let calendarView = localStorage.getItem('respiroCalendarView') === 'week' ? 'week' : 'month';
let tablePage = 1;
const itemsPerPage = 20;

// AUDIT LOG
let auditLog = [];
let historyFilter = { type: 'global' };
let historyPage = 1;
const historyItemsPerPage = 10;

// AUTENTICAÇÃO DE USUÁRIOS (session-only — resetado ao recarregar)
let currentUser = null;

function isAdmin() { return currentUser?.role === 'admin'; }

// Gráficos
let charts = {};
