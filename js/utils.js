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

// Rótulo de idade. O cadastro guarda só anos inteiros, então bebês entram como
// 0 — nesse caso mostramos "< 1 ano" em vez do confuso "0 anos".
function idadeLabel(idade) {
    const n = Number(idade);
    if (idade === null || idade === undefined || idade === '' || isNaN(n)) return '';
    if (n <= 0) return '< 1 ano';
    return `${n} ${n === 1 ? 'ano' : 'anos'}`;
}

// Nome encurtado para cards estreitos: mantém o primeiro nome e reduz o resto a
// iniciais ("MARIA VALENTINA OLIVEIRA LIMA" → "MARIA V. O. L.").
function abreviarNome(nome) {
    const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
    if (partes.length <= 1) return partes[0] || '';
    const iniciais = partes.slice(1).map(p => `${p[0].toUpperCase()}.`).join(' ');
    return `${partes[0]} ${iniciais}`;
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

// SUGESTÕES POR HISTÓRICO — logradouro/bairro/cidade/UF já usados em agendamentos
// anteriores. Os campos seguem a hierarquia UF > Cidade > Bairro > Logradouro: cada
// nível mais específico só sugere valores compatíveis com o que já foi preenchido nos
// níveis acima (ex.: bairro só mostra bairros da cidade/UF selecionadas).
const HIERARQUIA_ENDERECO = ['estado', 'cidade', 'bairro', 'logradouro'];

function valoresHistorico(campo, filtros = {}) {
    const vistos = new Set();
    const valores = [];
    Object.values(agendaData).forEach(lista => {
        lista.forEach(app => {
            const val = (app[campo] || '').trim();
            if (!val) return;

            // Descarta registros que não batem com os níveis superiores já preenchidos
            const bate = Object.entries(filtros).every(([campoFiltro, valorFiltro]) => {
                if (!valorFiltro) return true;
                return normalizeStr(app[campoFiltro] || '') === normalizeStr(valorFiltro);
            });
            if (!bate) return;

            const chave = normalizeStr(val);
            if (vistos.has(chave)) return;
            vistos.add(chave);
            valores.push(val);
        });
    });
    return valores.sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

// Monta os filtros hierárquicos acima do campo atual a partir do que já está
// preenchido no formulário (UF > Cidade > Bairro > Logradouro).
function filtrosHierarquiaAcima(campo) {
    const idx = HIERARQUIA_ENDERECO.indexOf(campo);
    if (idx <= 0) return {};
    const filtros = {};
    for (let i = 0; i < idx; i++) {
        const campoSuperior = HIERARQUIA_ENDERECO[i];
        const el = document.getElementById(`reg-${campoSuperior}`);
        const val = el ? el.value.trim() : '';
        if (val) filtros[campoSuperior] = val;
    }
    return filtros;
}

function filtrarSugestoes(campo, valor) {
    const popover = document.getElementById(`${campo}-popover`);
    const termo = normalizeStr(valor);
    const opcoes = valoresHistorico(campo, filtrosHierarquiaAcima(campo))
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

// Acha, no histórico, um registro cujo campo bata com o valor escolhido — respeitando
// os filtros hierárquicos já preenchidos — para poder puxar os campos vizinhos dele.
function registroHistoricoPara(campo, valor, filtros = {}) {
    const alvo = normalizeStr(valor);
    let encontrado = null;
    Object.values(agendaData).some(lista => lista.some(app => {
        if (normalizeStr(app[campo] || '') !== alvo) return false;
        const bate = Object.entries(filtros).every(([campoFiltro, valorFiltro]) => {
            if (!valorFiltro) return true;
            return normalizeStr(app[campoFiltro] || '') === normalizeStr(valorFiltro);
        });
        if (!bate) return false;
        encontrado = app;
        return true;
    }));
    return encontrado;
}

function selecionarSugestao(campo, valor) {
    document.getElementById(`reg-${campo}`).value = valor;
    document.getElementById(`${campo}-popover`).classList.add('hidden');

    // Preenchimento inverso: escolher um nível mais específico (ex.: logradouro) também
    // completa os níveis acima ainda vazios (bairro/cidade/UF), usando o registro
    // histórico daquele valor — evita redigitar o que já se sabe pelo logradouro.
    const idx = HIERARQUIA_ENDERECO.indexOf(campo);
    if (idx <= 0) return;
    const registro = registroHistoricoPara(campo, valor, filtrosHierarquiaAcima(campo));
    if (!registro) return;

    for (let i = 0; i < idx; i++) {
        const campoSuperior = HIERARQUIA_ENDERECO[i];
        const el = document.getElementById(`reg-${campoSuperior}`);
        if (!el || el.value.trim()) continue;
        const valSuperior = (registro[campoSuperior] || '').trim();
        if (valSuperior) el.value = campoSuperior === 'estado' ? valSuperior.toUpperCase() : valSuperior;
    }
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

    // Nenhum nome bate com o que foi digitado: em vez de esconder o popover
    // (deixando a pessoa sem pista do porquê o campo recusa o valor), explica
    // que só nomes da lista valem.
    if (!nomes.length) {
        popover.innerHTML = `
            <p class="px-3 py-2 text-[11px] font-bold text-slate-400">
                ${atendentesList.length
                    ? 'Nenhum atendente encontrado. Só nomes da lista são aceitos.'
                    : 'Lista de atendentes indisponível no momento.'}
            </p>`;
        popover.classList.remove('hidden');
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
    marcarCampoNomeValido(campo, true);
}

// ── VALIDAÇÃO DE NOME DA LISTA OFICIAL ──────────────────────
// Atendente e coletador só aceitam nomes da lista de atendentes: o campo é
// "digite para pesquisar e selecionar", não texto livre. Digitar um nome
// parcial ou inexistente e sair do campo não pode virar um registro salvo.
//
// Retorna o nome canônico (com a grafia da lista) ou null se não houver
// correspondência exata. Sem lista carregada, aceita o que veio — não dá para
// validar contra nada, e bloquear deixaria o formulário inutilizável offline.
function nomeOficialDe(valor) {
    const bruto = String(valor ?? '').trim();
    if (!bruto) return '';
    if (!atendentesList.length) return bruto;
    return atendentesList.find(a => normalizeStr(a) === normalizeStr(bruto)) || null;
}

// Realce visual do campo — vermelho enquanto o nome não confere
function marcarCampoNomeValido(campo, valido) {
    const el = document.getElementById(`reg-${campo}`);
    if (!el) return;
    el.classList.toggle('campo-nome-invalido', !valido);
}

// Conferência ao sair do campo: corrige a grafia para a da lista quando o nome
// existe, e sinaliza o erro quando não existe. Não apaga o que a pessoa
// digitou — quem escreveu precisa ver o que estava errado para corrigir.
function conferirNomeOficial(campo) {
    const el = document.getElementById(`reg-${campo}`);
    if (!el) return;
    const bruto = el.value.trim();
    if (!bruto) { marcarCampoNomeValido(campo, true); return; }

    const oficial = nomeOficialDe(bruto);
    if (oficial) {
        el.value = oficial;
        marcarCampoNomeValido(campo, true);
    } else {
        marcarCampoNomeValido(campo, false);
    }
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

// MARCA "DISTANTE" — realça a caixa de endereço quando o local exige deslocamento maior
function atualizarDistanteUI() {
    const chk = document.getElementById('reg-distante');
    if (!chk) return;
    const ativo = chk.checked;

    const box = document.getElementById('reg-endereco-box');
    const icone = document.getElementById('reg-endereco-icone');
    const selo = document.getElementById('reg-distante-selo');
    const label = document.getElementById('reg-distante-label');
    const chkIcone = document.getElementById('reg-distante-icone');
    const chkTexto = document.getElementById('reg-distante-texto');

    box.classList.toggle('bg-amber-50/60', !ativo);
    box.classList.toggle('border-amber-200', !ativo);
    box.classList.toggle('bg-violet-50', ativo);
    box.classList.toggle('border-violet-300', ativo);

    icone.classList.toggle('fa-house-medical', !ativo);
    icone.classList.toggle('text-amber-600', !ativo);
    icone.classList.toggle('fa-road-circle-exclamation', ativo);
    icone.classList.toggle('text-violet-600', ativo);

    selo.classList.toggle('hidden', !ativo);
    selo.classList.toggle('inline-flex', ativo);

    label.classList.toggle('border-slate-200', !ativo);
    label.classList.toggle('bg-white', !ativo);
    label.classList.toggle('border-violet-400', ativo);
    label.classList.toggle('bg-violet-100', ativo);

    chkIcone.classList.toggle('text-slate-300', !ativo);
    chkIcone.classList.toggle('text-violet-600', ativo);
    chkTexto.classList.toggle('text-slate-500', !ativo);
    chkTexto.classList.toggle('text-violet-700', ativo);
}

// TAXA DE COLETA — máscara de valor (BRL) + alternância Pago/A pagar
function formatarTaxaColeta(input) {
    let digits = input.value.replace(/\D/g, '');
    if (!digits) { input.value = ''; return; }
    digits = digits.replace(/^0+(?=\d)/, '');
    while (digits.length < 3) digits = '0' + digits;
    const inteiro = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const centavos = digits.slice(-2);
    input.value = `${inteiro},${centavos}`;
}

function taxaColetaValorNumerico() {
    const raw = document.getElementById('reg-taxa-valor').value.trim();
    if (!raw) return 0;
    return parseFloat(raw.replace(/\./g, '').replace(',', '.')) || 0;
}

function toggleTaxaColetaPago() {
    const hidden = document.getElementById('reg-taxa-pago');
    hidden.value = hidden.value === 'true' ? 'false' : 'true';
    atualizarTaxaColetaUI();
}

function atualizarTaxaColetaUI() {
    const box = document.getElementById('reg-taxa-box');
    const btn = document.getElementById('btn-taxa-pago');
    const icone = document.getElementById('reg-taxa-pago-icone');
    const texto = document.getElementById('reg-taxa-pago-texto');
    if (!box || !btn) return;

    const pago = document.getElementById('reg-taxa-pago').value === 'true';
    const temValor = taxaColetaValorNumerico() > 0;
    const ok = pago || temValor;

    box.classList.toggle('border-emerald-300', pago);
    box.classList.toggle('bg-emerald-50/60', pago);
    box.classList.toggle('border-amber-300', !pago && temValor);
    box.classList.toggle('bg-amber-50/60', !pago && temValor);
    box.classList.toggle('border-red-300', !ok);
    box.classList.toggle('bg-red-50/50', !ok);
    box.classList.toggle('border-slate-200', pago ? false : (temValor || !ok ? false : true));

    btn.classList.toggle('bg-emerald-600', pago);
    btn.classList.toggle('border-emerald-600', pago);
    btn.classList.toggle('text-white', pago);
    btn.classList.toggle('hover:bg-emerald-700', pago);
    btn.classList.toggle('bg-white', !pago);
    btn.classList.toggle('border-slate-200', !pago);
    btn.classList.toggle('text-slate-500', !pago);
    btn.classList.toggle('hover:border-emerald-400', !pago);

    icone.classList.toggle('fa-circle-notch', !pago);
    icone.classList.toggle('fa-circle-check', pago);
    texto.textContent = pago ? 'Pago' : 'A pagar';
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
