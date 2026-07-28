// Normalização de texto e cálculos de horário

// FUNÇÕES DE NORMALIZAÇÃO
function normalizeStr(str) {
    return String(str ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function formatAtendenteName(fullName) {
    const connectors = ['da', 'de', 'do', 'dos', 'das', 'e'];
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 2) return fullName.trim();
    if (connectors.includes(parts[1].toLowerCase()) && parts.length >= 3) {
        return `${parts[0]} ${parts[1]} ${parts[2]}`;
    }
    return `${parts[0]} ${parts[1]}`;
}

// CÁLCULOS DE HORÁRIO — a duração vem da configuração da agenda ativa
function calculateTimes() {
    const agenda = currentAgenda();
    const inicio = document.getElementById('reg-hora-inicio').value;
    const duracaoField = document.getElementById('reg-duracao');
    const fimField = document.getElementById('reg-hora-fim');

    const minutos = agenda.duracao.tipo === 'fixa'
        ? agenda.duracao.fixaMin
        : duracaoAgenda(document.getElementById('reg-exame').value, agenda);

    if (!minutos) { duracaoField.value = ''; fimField.value = ''; return; }

    duracaoField.value = duracaoLabel(minutos);
    if (inicio) {
        const fim = (timeToMin(inicio) + minutos) % 1440;
        fimField.value = minToTime(fim);
    }
}

// ESTADOS (UF) — campo pesquisável por sigla ou nome, só aceita valores válidos
const ESTADOS_BR = [
    { sigla: 'AC', nome: 'Acre' }, { sigla: 'AL', nome: 'Alagoas' }, { sigla: 'AP', nome: 'Amapá' },
    { sigla: 'AM', nome: 'Amazonas' }, { sigla: 'BA', nome: 'Bahia' }, { sigla: 'CE', nome: 'Ceará' },
    { sigla: 'DF', nome: 'Distrito Federal' }, { sigla: 'ES', nome: 'Espírito Santo' }, { sigla: 'GO', nome: 'Goiás' },
    { sigla: 'MA', nome: 'Maranhão' }, { sigla: 'MT', nome: 'Mato Grosso' }, { sigla: 'MS', nome: 'Mato Grosso do Sul' },
    { sigla: 'MG', nome: 'Minas Gerais' }, { sigla: 'PA', nome: 'Pará' }, { sigla: 'PB', nome: 'Paraíba' },
    { sigla: 'PR', nome: 'Paraná' }, { sigla: 'PE', nome: 'Pernambuco' }, { sigla: 'PI', nome: 'Piauí' },
    { sigla: 'RJ', nome: 'Rio de Janeiro' }, { sigla: 'RN', nome: 'Rio Grande do Norte' }, { sigla: 'RS', nome: 'Rio Grande do Sul' },
    { sigla: 'RO', nome: 'Rondônia' }, { sigla: 'RR', nome: 'Roraima' }, { sigla: 'SC', nome: 'Santa Catarina' },
    { sigla: 'SP', nome: 'São Paulo' }, { sigla: 'SE', nome: 'Sergipe' }, { sigla: 'TO', nome: 'Tocantins' }
];

function estadoOptionLabel(uf) {
    return `${uf.nome} — ${uf.sigla}`;
}

function encontrarEstado(valor) {
    const termo = normalizeStr(valor);
    if (!termo) return null;
    return ESTADOS_BR.find(uf =>
        normalizeStr(uf.sigla) === termo ||
        normalizeStr(estadoOptionLabel(uf)) === termo ||
        normalizeStr(uf.nome) === termo
    ) || null;
}

function filtrarEstados(valor) {
    const popover = document.getElementById('estados-popover');
    const termo = normalizeStr(valor);
    const opcoes = termo
        ? ESTADOS_BR.filter(uf => normalizeStr(uf.nome).includes(termo) || normalizeStr(uf.sigla).includes(termo))
        : ESTADOS_BR;

    if (!opcoes.length) {
        popover.innerHTML = `<div class="px-3 py-2 text-[11px] font-bold text-slate-400">Nenhum estado encontrado</div>`;
    } else {
        popover.innerHTML = opcoes.map(uf => `
            <button type="button" onmousedown="event.preventDefault(); selecionarEstado('${uf.sigla}')"
                class="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-[12px] font-bold text-slate-600 hover:bg-teal-50 hover:text-teal-700 transition-colors">
                <span>${uf.nome}</span>
                <span class="text-[10px] font-black text-slate-400 group-hover:text-teal-600">${uf.sigla}</span>
            </button>
        `).join('');
    }
    popover.classList.remove('hidden');
}

function selecionarEstado(sigla) {
    document.getElementById('reg-estado').value = sigla;
    document.getElementById('estados-popover').classList.add('hidden');
}

function validarEstado() {
    const input = document.getElementById('reg-estado');
    const uf = encontrarEstado(input.value);
    input.value = uf ? uf.sigla : '';
    document.getElementById('estados-popover').classList.add('hidden');
}

// SUGESTÕES POR HISTÓRICO — logradouro/bairro/cidade já usados em agendamentos anteriores
function valoresHistorico(campo) {
    const vistos = new Set();
    const valores = [];
    Object.values(agendaData).forEach(lista => {
        lista.forEach(app => {
            const val = (app[campo] || '').trim();
            if (!val) return;
            const chave = normalizeStr(val);
            if (vistos.has(chave)) return;
            vistos.add(chave);
            valores.push(val);
        });
    });
    return valores.sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function filtrarSugestoes(campo, valor) {
    const popover = document.getElementById(`${campo}-popover`);
    const termo = normalizeStr(valor);
    const opcoes = valoresHistorico(campo)
        .filter(v => !termo || normalizeStr(v).includes(termo))
        .slice(0, 8);

    if (!opcoes.length) {
        popover.classList.add('hidden');
        return;
    }

    popover.innerHTML = opcoes.map(v => `
        <button type="button" onmousedown="event.preventDefault(); selecionarSugestao('${campo}', '${v.replace(/'/g, "\\'")}')"
            class="w-full px-3 py-2 text-left text-[12px] font-bold text-slate-600 hover:bg-teal-50 hover:text-teal-700 transition-colors">
            ${v}
        </button>
    `).join('');
    popover.classList.remove('hidden');
}

function selecionarSugestao(campo, valor) {
    document.getElementById(`reg-${campo}`).value = valor;
    document.getElementById(`${campo}-popover`).classList.add('hidden');
}

function fecharSugestoesTardio(campo) {
    setTimeout(() => document.getElementById(`${campo}-popover`).classList.add('hidden'), 150);
}

// SUGESTÕES DE PACIENTE — nomes já cadastrados na agenda ativa
function filtrarPacientes(valor) {
    const popover = document.getElementById('paciente-popover');
    const termo = normalizeStr(valor);
    const nomes = [...new Set(appointments.map(a => a.paciente).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'pt-BR'))
        .filter(n => !termo || normalizeStr(n).includes(termo))
        .slice(0, 8);

    if (!nomes.length) {
        popover.classList.add('hidden');
        return;
    }

    popover.innerHTML = nomes.map(n => `
        <button type="button" onmousedown="event.preventDefault(); selecionarPaciente('${n.replace(/'/g, "\\'")}')"
            class="w-full px-3 py-2 text-left text-[12px] font-bold text-slate-600 hover:bg-teal-50 hover:text-teal-700 transition-colors">
            ${n}
        </button>
    `).join('');
    popover.classList.remove('hidden');
}

function selecionarPaciente(nome) {
    document.getElementById('reg-paciente').value = nome;
    document.getElementById('paciente-popover').classList.add('hidden');
}

// SUGESTÕES DE ATENDENTE/COLETADOR — nomes da lista oficial de atendentes
function filtrarAtendentes(campo, valor) {
    const popover = document.getElementById(`${campo}-popover`);
    const termo = normalizeStr(valor);
    const nomes = atendentesList
        .filter(n => !termo || normalizeStr(n).includes(termo))
        .slice(0, 8);

    if (!nomes.length) {
        popover.classList.add('hidden');
        return;
    }

    popover.innerHTML = nomes.map(n => `
        <button type="button" onmousedown="event.preventDefault(); selecionarAtendente('${campo}', '${n.replace(/'/g, "\\'")}')"
            class="w-full px-3 py-2 text-left text-[12px] font-bold text-slate-600 hover:bg-teal-50 hover:text-teal-700 transition-colors">
            ${n}
        </button>
    `).join('');
    popover.classList.remove('hidden');
}

function selecionarAtendente(campo, nome) {
    document.getElementById(`reg-${campo}`).value = nome;
    document.getElementById(`${campo}-popover`).classList.add('hidden');
}

// MAPA DO ENDEREÇO — embed do Google Maps sem API key (busca por texto)
function enderecoParaMapa() {
    const logradouro = document.getElementById('reg-logradouro').value.trim();
    const numero = document.getElementById('reg-numero').value.trim();
    const bairro = document.getElementById('reg-bairro').value.trim();
    const cidade = document.getElementById('reg-cidade').value.trim();
    const estado = document.getElementById('reg-estado').value.trim();
    const cep = document.getElementById('reg-cep').value.trim();

    const partes = [
        [logradouro, numero].filter(Boolean).join(', '),
        bairro, cidade, estado, cep
    ].filter(Boolean);

    return partes.join(', ');
}

function toggleMapaEndereco() {
    const container = document.getElementById('mapa-endereco-container');
    const label = document.getElementById('btn-mapa-label');
    const iframe = document.getElementById('mapa-endereco-iframe');
    const chevron = document.querySelector('#btn-mapa-toggle .fa-chevron-down');

    if (!container.classList.contains('hidden')) {
        container.classList.add('hidden');
        iframe.src = '';
        label.textContent = 'Ver no mapa';
        chevron.style.transform = '';
        return;
    }

    const endereco = enderecoParaMapa();
    if (!endereco) {
        showNotification('Preencha ao menos o logradouro ou o CEP para localizar no mapa.', 'error');
        return;
    }

    iframe.src = `https://maps.google.com/maps?q=${encodeURIComponent(endereco)}&output=embed`;
    container.classList.remove('hidden');
    label.textContent = 'Ocultar mapa';
    chevron.style.transform = 'rotate(180deg)';
}

// BUSCA DE ENDEREÇO POR CEP (ViaCEP) — preenche logradouro/bairro/cidade automaticamente
function formatCep(input) {
    const digits = input.value.replace(/\D/g, '').slice(0, 8);
    input.value = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

async function buscarCep() {
    const cepInput = document.getElementById('reg-cep');
    const cep = cepInput.value.replace(/\D/g, '');
    const logradouroEl = document.getElementById('reg-logradouro');
    const bairroEl = document.getElementById('reg-bairro');
    const cidadeEl = document.getElementById('reg-cidade');
    const numeroEl = document.getElementById('reg-numero');

    if (cep.length !== 8) return;

    cepInput.classList.add('opacity-60');
    try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await res.json();

        if (data.erro) {
            showNotification('CEP não encontrado.', 'error');
            return;
        }

        logradouroEl.value = data.logradouro || logradouroEl.value;
        bairroEl.value = (data.bairro || '').toUpperCase();
        cidadeEl.value = (data.localidade || '').toUpperCase();
        document.getElementById('reg-estado').value = data.uf || '';

        if (data.logradouro) {
            numeroEl.focus();
        } else {
            logradouroEl.focus();
        }
    } catch (err) {
        showNotification('Não foi possível buscar o CEP. Verifique sua conexão.', 'error');
    } finally {
        cepInput.classList.remove('opacity-60');
    }
}

function updateSubstratos() {
    const agenda = currentAgenda();
    const subSelect = document.getElementById('reg-substrato');
    const metanoDiv = document.querySelector('[data-agenda-campo="metano"]');

    // Agendas sem exame/substrato não têm o que atualizar
    if (!temCampo('exame', agenda)) {
        subSelect.innerHTML = '';
        document.getElementById('reg-metano').value = 'Não';
        return;
    }

    const exame = document.getElementById('reg-exame').value;
    const opcoes = agenda.substratos[exame] || [];
    subSelect.innerHTML = opcoes.length
        ? opcoes.map(o => `<option value="${o}">${o}</option>`).join('')
        : '<option value="">Aguardando exame...</option>';

    // Metano só se aplica ao TSBAC
    const usaMetano = temCampo('metano', agenda) && exame === 'TSBAC';
    if (metanoDiv) metanoDiv.classList.toggle('hidden', !usaMetano);
    document.getElementById('reg-metano').required = usaMetano;
    if (!usaMetano) document.getElementById('reg-metano').value = 'Não';
}
