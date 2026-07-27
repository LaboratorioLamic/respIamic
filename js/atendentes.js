// Atendentes e filtros dinâmicos da tabela

// FETCH ATENDENTES
async function loadAtendentes() {
    try {
        const response = await fetch("https://script.google.com/macros/s/AKfycbzUd6efhfzkCmYd88_eIIL6dGIQxIINsw-6Y_qM3PRemUbZ06obtF9xKY1S8WRfvXyq9Q/exec");
        atendentesList = await response.json();
        const list = document.getElementById('atendentes-list');
        list.innerHTML = atendentesList.map(name => `<option value="${name}">`).join('');
        updateFilterDropdowns();
        populateRegAttendentesList();
    } catch (e) { console.error("Erro ao carregar atendentes", e); }
}

function updateDatalists() {
    const list = document.getElementById('pacientes-list');
    const uniquePatients = [...new Set(appointments.map(a => a.paciente))];
    list.innerHTML = uniquePatients.map(name => `<option value="${name}">`).join('');
}

function updateFilterDropdowns() {
    const search = normalizeStr(document.getElementById('filter-search').value);
    const atendente = document.getElementById('filter-atendente').value;
    const substrato = document.getElementById('filter-substrato').value;
    const status = document.getElementById('filter-status').value;
    
    // Para cada filtro, calcular os dados base sem considerar o filtro atual
    // Filtro de atendente: considerar busca, substrato e status
    let filteredForAtendente = appointments.filter(a => {
        const matchSearch = !search || normalizeStr(a.paciente).includes(search) || normalizeStr(a.pedido).includes(search);
        const matchSubstrato = !substrato || a.substrato === substrato;
        const matchStatus = !status || a.status === status;
        return matchSearch && matchSubstrato && matchStatus;
    });
    
    // Filtro de substrato: considerar busca, atendente e status
    let filteredForSubstrato = appointments.filter(a => {
        const matchSearch = !search || normalizeStr(a.paciente).includes(search) || normalizeStr(a.pedido).includes(search);
        const matchAtendente = !atendente || a.atendente === atendente;
        const matchStatus = !status || a.status === status;
        return matchSearch && matchAtendente && matchStatus;
    });
    
    // Filtro de status: considerar busca, atendente e substrato
    let filteredForStatus = appointments.filter(a => {
        const matchSearch = !search || normalizeStr(a.paciente).includes(search) || normalizeStr(a.pedido).includes(search);
        const matchAtendente = !atendente || a.atendente === atendente;
        const matchSubstrato = !substrato || a.substrato === substrato;
        return matchSearch && matchAtendente && matchSubstrato;
    });
    
    // Atualizar filtro de atendente
    const atendenteFilter = document.getElementById('filter-atendente');
    const uniqueAtendentes = [...new Set(filteredForAtendente.map(a => a.atendente))];
    atendenteFilter.innerHTML = '<option value="">Filtrar por Atendente</option>' + 
        uniqueAtendentes.map(name => `<option value="${name}">${name}</option>`).join('');
    
    if (atendente && !uniqueAtendentes.includes(atendente)) {
        atendenteFilter.value = '';
    } else {
        atendenteFilter.value = atendente;
    }

    // Atualizar filtro de substrato
    const substratoFilter = document.getElementById('filter-substrato');
    const uniqueSubstratos = [...new Set(filteredForSubstrato.map(a => a.substrato))];
    substratoFilter.innerHTML = '<option value="">Filtrar por Substrato</option>' + 
        uniqueSubstratos.map(sub => `<option value="${sub}">${sub}</option>`).join('');
    
    if (substrato && !uniqueSubstratos.includes(substrato)) {
        substratoFilter.value = '';
    } else {
        substratoFilter.value = substrato;
    }

    // Atualizar filtro de status
    const statusFilter = document.getElementById('filter-status');
    const uniqueStatuses = [...new Set(filteredForStatus.map(a => a.status))];
    statusFilter.innerHTML = '<option value="">Filtrar por Status</option>' + 
        uniqueStatuses.map(status => `<option value="${status}">${status}</option>`).join('');
    
    if (status && !uniqueStatuses.includes(status)) {
        statusFilter.value = '';
    } else {
        statusFilter.value = status;
    }
}
