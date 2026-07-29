// Pacientes adicionais atendidos na MESMA visita domiciliar.
// São pessoas do mesmo endereço, atendidas no mesmo horário: o agendamento
// continua sendo um só e não consome vaga extra na agenda.

let _acompanhanteSeq = 0;

// Linha de formulário de um acompanhante
function _acompanhanteHtml(id, dados) {
    const d = dados || {};
    return `
    <div class="acompanhante-linha grid grid-cols-1 md:grid-cols-12 gap-3 items-end p-3 bg-slate-50 border border-slate-200 rounded-xl" data-acomp-id="${id}">
        <div class="md:col-span-6">
            <label class="block text-[10px] font-black text-slate-400 uppercase mb-2">Nome do Paciente *</label>
            <input type="text" data-acomp="nome" value="${_acompEscape(d.nome)}"
                oninput="this.value = this.value.toUpperCase()"
                class="w-full border border-slate-200 bg-white rounded-xl py-2.5 px-3 shadow-sm uppercase">
        </div>
        <div class="md:col-span-2">
            <label class="block text-[10px] font-black text-slate-400 uppercase mb-2">Idade *</label>
            <input type="number" data-acomp="idade" min="0" value="${d.idade ?? ''}"
                class="w-full border border-slate-200 bg-white rounded-xl py-2.5 px-3 shadow-sm">
        </div>
        <div class="md:col-span-3">
            <label class="block text-[10px] font-black text-slate-400 uppercase mb-2">Nº do Pedido</label>
            <input type="text" data-acomp="pedido" value="${_acompEscape(d.pedido)}"
                class="w-full border border-slate-200 bg-white rounded-xl py-2.5 px-3 shadow-sm">
        </div>
        <div class="md:col-span-1 flex justify-end">
            <button type="button" onclick="removerAcompanhante('${id}')" title="Remover paciente"
                class="h-[42px] w-full md:w-[42px] rounded-xl border border-red-200 bg-white text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm flex items-center justify-center">
                <i class="fas fa-trash text-sm"></i>
            </button>
        </div>
    </div>`;
}

function _acompEscape(v) {
    return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function adicionarAcompanhante(dados) {
    const lista = document.getElementById('acompanhantes-lista');
    if (!lista) return;
    const id = `ac${++_acompanhanteSeq}`;
    lista.insertAdjacentHTML('beforeend', _acompanhanteHtml(id, dados));
    _atualizarAjudaAcompanhantes();
    if (!dados) lista.querySelector(`[data-acomp-id="${id}"] [data-acomp="nome"]`)?.focus();
}

function removerAcompanhante(id) {
    document.querySelector(`[data-acomp-id="${id}"]`)?.remove();
    _atualizarAjudaAcompanhantes();
}

function limparAcompanhantes() {
    const lista = document.getElementById('acompanhantes-lista');
    if (lista) lista.innerHTML = '';
    _atualizarAjudaAcompanhantes();
}

function _atualizarAjudaAcompanhantes() {
    const ajuda = document.getElementById('acompanhantes-ajuda');
    if (ajuda) ajuda.classList.toggle('hidden', !document.querySelectorAll('.acompanhante-linha').length);
}

// Preenche as linhas a partir de um registro salvo
function carregarAcompanhantes(app) {
    limparAcompanhantes();
    (app.acompanhantes || []).forEach(a => adicionarAcompanhante(a));
}

// Lê as linhas do formulário, descartando as que ficaram sem nome
function lerAcompanhantes() {
    return [...document.querySelectorAll('.acompanhante-linha')].map(linha => {
        const val = campo => linha.querySelector(`[data-acomp="${campo}"]`).value.trim();
        const idade = val('idade');
        return {
            nome: val('nome').toUpperCase(),
            idade: idade === '' ? null : parseInt(idade),
            pedido: val('pedido')
        };
    }).filter(a => a.nome);
}

// ── LEITURA (usada pelos cards, tabela e ficha) ─────────────
// Total de pessoas atendidas na visita, incluindo o paciente titular
function totalPacientes(app) {
    return 1 + ((app.acompanhantes || []).length);
}

// Rótulo "+n" exibido ao lado do nome do titular
function extraPacientesLabel(app) {
    const extras = (app.acompanhantes || []).length;
    return extras ? `+${extras}` : '';
}

// Nomes de todos os pacientes da visita, na ordem
function nomesPacientes(app) {
    return [app.paciente, ...(app.acompanhantes || []).map(a => a.nome)].filter(Boolean);
}
