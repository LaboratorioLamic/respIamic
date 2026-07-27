// UI de checklist, comentários e duplicação de agendamento

// UI CHECKLIST E COMENTARIOS
function toggleComentario() {
    const box = document.getElementById('box-motivo');
    box.classList.toggle('hidden');
}

function toggleCheck(type) {
    const input = document.getElementById(`chk-${type}-val`);
    const isChecked = input.value === 'true';
    input.value = !isChecked ? 'true' : 'false';
    updateCheckUI(type, !isChecked);
}

function updateCheckUI(type, isChecked) {
    const btn = document.getElementById(`btn-chk-${type}`);
    if (isChecked) {
        btn.classList.add('border-blue-500', 'bg-blue-50', 'text-blue-600');
        btn.classList.remove('border-slate-200', 'bg-white', 'text-slate-400');
    } else {
        btn.classList.remove('border-blue-500', 'bg-blue-50', 'text-blue-600');
        btn.classList.add('border-slate-200', 'bg-white', 'text-slate-400');
    }
}

function toggleCancelado() {
    const status = document.getElementById('reg-status').value;
    const boxMotivo = document.getElementById('box-motivo');
    const txtMotivo = document.getElementById('reg-comentarios');
    const lblMotivo = document.getElementById('lbl-comentario');
    const btnToggle = document.getElementById('btn-toggle-comentario');
    const campoPedido = document.getElementById('reg-pedido');
    const campoPedidoContainer = document.getElementById('campo-pedido-container');
    const checklistBox = document.querySelector('.bg-slate-50.p-5.rounded-2xl.border.border-slate-200');
    
    // Ajusta campos obrigatórios baseado no status
    if (status === 'Em andamento') {
        campoPedido.required = false;
        campoPedido.classList.remove('border-red-300');
        campoPedido.classList.add('border-slate-200');
        
        // Oculta campo Nº do Pedido completamente
        if (campoPedidoContainer) campoPedidoContainer.classList.add('hidden');
        
        // Esconde checklist
        if (checklistBox) checklistBox.classList.add('hidden');
    } else if (status === 'Cancelado') {
        campoPedido.required = false;
        campoPedido.classList.remove('border-red-300');
        campoPedido.classList.add('border-slate-200');
        
        // Mostra campo Nº do Pedido (mas não obrigatório)
        if (campoPedidoContainer) campoPedidoContainer.classList.remove('hidden');
        
        // Mostra checklist (mas não obrigatório)
        if (checklistBox) checklistBox.classList.remove('hidden');
    } else {
        campoPedido.required = true;
        // Mantém borda normal, sem vermelho
        campoPedido.classList.remove('border-red-300');
        campoPedido.classList.add('border-slate-200');
        
        // Mostra campo Nº do Pedido
        if (campoPedidoContainer) campoPedidoContainer.classList.remove('hidden');
        
        // Mostra checklist
        if (checklistBox) checklistBox.classList.remove('hidden');
    }
    
    if (status === 'Cancelado') {
        txtMotivo.required = true;
        boxMotivo.classList.remove('hidden');
        btnToggle.classList.add('hidden');

        boxMotivo.classList.add('bg-red-50', 'border-red-200');
        boxMotivo.classList.remove('bg-slate-50', 'border-slate-200');
        lblMotivo.innerText = "Motivo do Cancelamento *";
        lblMotivo.classList.add('text-red-600');
        lblMotivo.classList.remove('text-slate-400');
        txtMotivo.classList.add('focus:ring-red-500');
        txtMotivo.classList.remove('focus:ring-blue-500');

        document.getElementById('box-motivo-perda').classList.remove('hidden');
        updateMotivosPerdaSelect();
    } else {
        txtMotivo.required = false;
        boxMotivo.classList.add('hidden');
        btnToggle.classList.remove('hidden');

        boxMotivo.classList.remove('bg-red-50', 'border-red-200');
        boxMotivo.classList.add('bg-slate-50', 'border-slate-200');
        lblMotivo.innerText = "Comentários Operacionais (Opcional)";
        lblMotivo.classList.remove('text-red-600');
        lblMotivo.classList.add('text-slate-400');
        txtMotivo.classList.remove('focus:ring-red-500');
        txtMotivo.classList.add('focus:ring-blue-500');

        document.getElementById('box-motivo-perda').classList.add('hidden');
        document.getElementById('reg-motivo-perda').value = '';
    }
}

// DUPLICAR AGENDAMENTO
function duplicateRecord() {
    const paciente = document.getElementById('reg-paciente').value;
    const idade    = document.getElementById('reg-idade').value;
    const contato  = document.getElementById('reg-contato').value;
    const pedido   = document.getElementById('reg-pedido').value;

    closeModals();

    // Pequeno delay para garantir que o modal fechou antes de reabrir
    setTimeout(() => {
        openRecordModal();
        document.getElementById('reg-paciente').value = paciente;
        document.getElementById('reg-idade').value    = idade;
        document.getElementById('reg-contato').value  = contato;
        document.getElementById('reg-pedido').value   = pedido;
    }, 150);
}
