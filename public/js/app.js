import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js'
import {
  addDoc,
  collection,
  doc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js'

const firebaseConfig = {
  apiKey: 'AIzaSyDZrv5oWMFIAxENJNDQ955p7Qd6emAucZ8',
  authDomain: 'visita-hub.firebaseapp.com',
  projectId: 'visita-hub',
  storageBucket: 'visita-hub.appspot.com',
  messagingSenderId: '822877939306',
  appId: '1:822877939306:web:c5f51e535c16e9996acc13',
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

let currentPage = 1
const pageSize = 5
let todasVisitas = []

document.addEventListener('DOMContentLoaded', () => {
  const elements = {
    links: document.querySelectorAll('.nav-link'),
    pages: document.querySelectorAll('.content-page'),
    backButtons: document.querySelectorAll('.btn.text-btn'),
    newConvidadoBtn: document.getElementById('newConvidadoBtn'),
    newConvidadoBtn2: document.getElementById('newConvidadoBtn2'),
    newVisitaBtn: document.getElementById('newVisitaBtn'),
    form: document.querySelector('#novo-convidado .form-container'),
    cpfInput: document.getElementById('guest-doc'),
    phoneInput: document.getElementById('guest-phone'),
    searchInput: document.getElementById('searchInput'),
    exportBtn: document.getElementById('exportBtn'),
    prevPageBtn: document.getElementById('prevPage'),
    nextPageBtn: document.getElementById('nextPage'),
    visitorNameInput: document.getElementById('visitor-name'),
    guestResults: document.getElementById('guest-results'),
    visitorCompanyInput: document.getElementById('visitor-company'),
    visitaForm: document.getElementById('visita-form'),
    hostInput: document.getElementById('visitor-host'),
    hostResults: document.getElementById('host-results'),
    registrosSearchInput: document.querySelector('#registros .filter-panel input[type="search"]'),
    registrosExportBtn: document.querySelector('#registros .header-buttons .btn.secondary-btn'),
    metricCards: document.querySelectorAll('.metric-card .metric-value'),
  }

  function showPage(pageName) {
    if (pageName === 'sair') {
      sessionStorage.clear()
      localStorage.clear()
      window.location.href = '/index.html'
      return
    }

    // Mostra a tela de loading apenas para o dashboard
    if (pageName === 'dashboard') {
      const loadingScreen = document.getElementById('loadingScreen')
      if (loadingScreen) {
        loadingScreen.classList.remove('hidden')
      }
    }

    elements.pages.forEach((page) => {
      if (page.dataset.page === pageName) {
        page.style.display = 'block'
        requestAnimationFrame(() => {
          page.classList.add('active-content')
        })

        if (pageName === 'convidados') {
          loadConvidados()
        } else if (pageName === 'registros') {
          carregarHistoricoVisitas()
        } else if (pageName === 'registrar-visita') {
          carregarVisitasAtivas()
        } else if (pageName === 'dashboard') {
          // Esconde o loading após carregar tudo
          Promise.all([atualizarMetricas(), carregarVisitasAtivas()]).finally(() => {
            const loadingScreen = document.getElementById('loadingScreen')
            if (loadingScreen) {
              setTimeout(() => {
                loadingScreen.classList.add('hidden')
              }, 500)
            }
          })
        }
      } else {
        page.classList.remove('active-content')
        setTimeout(() => {
          page.style.display = 'none'
        }, 100)
      }
    })
  }

  function setupEventListeners() {
    elements.links.forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault()
        showPage(link.dataset.page)
      })
    })

    elements.backButtons.forEach((button) => {
      button.addEventListener('click', () => showPage('dashboard'))
    })

    if (elements.newConvidadoBtn)
      elements.newConvidadoBtn.addEventListener('click', () => showPage('novo-convidado'))
    if (elements.newVisitaBtn)
      elements.newVisitaBtn.addEventListener('click', () => showPage('registrar-visita'))
    if (elements.newConvidadoBtn2)
      elements.newConvidadoBtn2.addEventListener('click', () => showPage('novo-convidado'))

    if (elements.form) elements.form.addEventListener('submit', handleFormSubmit)
    if (elements.visitaForm) elements.visitaForm.addEventListener('submit', handleVisitaSubmit)

    if (elements.cpfInput) elements.cpfInput.addEventListener('input', formatCPFInput)
    if (elements.phoneInput) elements.phoneInput.addEventListener('input', formatPhoneInput)

    if (elements.searchInput) elements.searchInput.addEventListener('input', handleSearchInput)
    if (elements.prevPageBtn) elements.prevPageBtn.addEventListener('click', handlePrevPage)
    if (elements.nextPageBtn) elements.nextPageBtn.addEventListener('click', handleNextPage)
    if (elements.registrosSearchInput) {
      elements.registrosSearchInput.addEventListener('input', (e) => {
        carregarHistoricoVisitas(e.target.value)
      })
    }

    if (elements.exportBtn) elements.exportBtn.addEventListener('click', exportConvidadosToXLSX)
    if (elements.registrosExportBtn)
      elements.registrosExportBtn.addEventListener('click', exportVisitasToXLSX)

    if (elements.visitorNameInput) setupVisitorSearch()
    if (elements.hostInput) setupHostSearch()

    document.querySelector('.panel-actions .btn:nth-child(1)').addEventListener('click', () => {
      carregarVisitasAtivas()
      atualizarMetricas()
    })
  }

  function handlePrevPage() {
    if (currentPage > 1) {
      currentPage--
      loadConvidados(getSearchFilter())
    }
  }

  function handleNextPage() {
    currentPage++
    loadConvidados(getSearchFilter())
  }

  function handleSearchInput(e) {
    currentPage = 1
    loadConvidados(e.target.value)
  }

  function getSearchFilter() {
    return elements.searchInput ? elements.searchInput.value.trim().toLowerCase() : ''
  }

  async function handleFormSubmit(e) {
    e.preventDefault()

    const formData = {
      nome: document.getElementById('guest-name').value.trim(),
      nome_lowercase: document.getElementById('guest-name').value.trim().toLowerCase(),
      empresa: document.getElementById('guest-company').value.trim(),
      cpf: document.getElementById('guest-doc').value.replace(/\D/g, ''),
      telefone: document.getElementById('guest-phone').value.trim(),
    }

    if (!validateForm(formData)) return

    const submitBtn = e.target.querySelector('button[type="submit"]')
    const originalBtnContent = submitBtn.innerHTML
    submitBtn.innerHTML = '<i class="ri-loader-4-line spin"></i> Processando...'
    submitBtn.disabled = true

    try {
      await addDoc(collection(db, 'convidados'), {
        ...formData,
        criadoEm: new Date(),
        status: 'ativo',
      })

      showAlert(`Convidado "${formData.nome}" cadastrado com sucesso!`, 'success')
      e.target.reset()
      setTimeout(() => showPage('convidados'), 2000)
    } catch (error) {
      console.error('Erro ao cadastrar convidado:', error)
      showAlert(`Erro ao cadastrar: ${error.message}`, 'error')
    } finally {
      submitBtn.innerHTML = originalBtnContent
      submitBtn.disabled = false
    }
  }

  async function handleVisitaSubmit(e) {
    e.preventDefault()

    const visitaData = {
      convidadoNome: document.getElementById('visitor-name').value.trim(),
      motivoVisita: document.getElementById('visit-purpose').value,
      anfitriao: document.getElementById('visitor-host').value.trim(),
      cracha: document.getElementById('visitor-badge').value.trim(),
      status: 'ativo',
      checkIn: Timestamp.now(),
      dataCheckOut: null,
    }

    // Validação dos campos obrigatórios
    if (
      !visitaData.convidadoNome ||
      !visitaData.anfitriao ||
      !visitaData.cracha ||
      !visitaData.motivoVisita
    ) {
      showAlert('Preencha todos os campos obrigatórios!', 'error')
      return
    }

    const submitBtn = e.target.querySelector('button[type="submit"]')
    const originalText = submitBtn.innerHTML

    try {
      submitBtn.disabled = true
      submitBtn.innerHTML = '<i class="ri-loader-4-line spin"></i> Verificando...'

      // Verificar se o crachá já está em uso
      const crachaEmUso = await verificarCrachaEmUso(visitaData.cracha)

      if (crachaEmUso) {
        showAlert(
          `O crachá ${visitaData.cracha} já está em uso! Por favor, faça o check-out da visita anterior antes de registrar uma nova.`,
          'error',
        )
        return
      }

      submitBtn.innerHTML = '<i class="ri-loader-4-line spin"></i> Registrando...'

      await addDoc(collection(db, 'visitas'), visitaData)

      showAlert(`Visita registrada com sucesso!`, 'success')

      setTimeout(() => {
        e.target.reset()
        showPage('dashboard')
      }, 2000)
    } catch (error) {
      console.error('Erro ao registrar visita:', error)
      showAlert(`Erro ao registrar visita: ${error.message}`, 'error')
    } finally {
      submitBtn.disabled = false
      submitBtn.innerHTML = originalText
    }
  }

  function validateForm({ nome, empresa, cpf, telefone }) {
    if (!nome || !empresa || !cpf || !telefone) {
      showAlert('Por favor, preencha todos os campos obrigatórios!', 'error')
      return false
    }

    if (cpf.length !== 11) {
      showAlert('CPF inválido! Deve conter 11 dígitos.', 'error')
      return false
    }

    const phoneRegex = /^\(\d{2}\) \d{4,5}-\d{4}$/
    if (!phoneRegex.test(telefone)) {
      showAlert('Por favor, insira um telefone válido no formato (00) 00000-0000', 'error')
      return false
    }

    return true
  }

  function setupVisitorSearch() {
    let searchTimeout

    elements.visitorNameInput.addEventListener('input', async (e) => {
      const searchTerm = e.target.value.trim().toLowerCase()

      clearTimeout(searchTimeout)

      if (searchTerm.length < 1) {
        elements.guestResults.classList.remove('show')
        return
      }

      elements.guestResults.innerHTML =
        '<div class="loading-results"><i class="ri-loader-4-line spin"></i> Buscando convidados...</div>'
      elements.guestResults.classList.add('show')

      searchTimeout = setTimeout(async () => {
        try {
          const convidadosRef = collection(db, 'convidados')
          const allDocs = await getDocs(convidadosRef)

          const filtered = []
          allDocs.forEach((doc) => {
            const convidado = doc.data()
            if (
              (convidado.nome && convidado.nome.toLowerCase().includes(searchTerm)) ||
              (convidado.empresa && convidado.empresa.toLowerCase().includes(searchTerm))
            ) {
              filtered.push({
                id: doc.id,
                ...convidado,
              })
            }
          })

          elements.guestResults.innerHTML = ''

          if (filtered.length === 0) {
            elements.guestResults.innerHTML =
              '<div class="result-item">Nenhum convidado encontrado</div>'
          } else {
            filtered.slice(0, 5).forEach((convidado) => {
              const item = document.createElement('div')
              item.className = 'result-item'
              item.innerHTML = `
                <strong>${convidado.nome}</strong>
                <small>${convidado.empresa || 'Sem empresa'} • ${formatCPFDisplay(convidado.cpf)}</small>
              `

              item.addEventListener('click', () => {
                elements.visitorNameInput.value = convidado.nome
                if (elements.visitorCompanyInput) {
                  elements.visitorCompanyInput.value = convidado.empresa || ''
                }
                elements.guestResults.classList.remove('show')
              })

              elements.guestResults.appendChild(item)
            })
          }
        } catch (error) {
          console.error('Erro na busca:', error)
          elements.guestResults.innerHTML = `
            <div class="error-results">
              <i class="ri-error-warning-line"></i> Erro na busca
              <br><small>${error.message}</small>
            </div>
          `
        }
      }, 300)
    })

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-container')) {
        elements.guestResults.classList.remove('show')
      }
    })
  }

  function setupHostSearch() {
    let searchTimeout

    elements.hostInput.addEventListener('input', async (e) => {
      const searchTerm = e.target.value.trim().toLowerCase()

      clearTimeout(searchTimeout)

      if (searchTerm.length < 1) {
        elements.hostResults.classList.remove('show')
        return
      }

      elements.hostResults.innerHTML =
        '<div class="loading-results"><i class="ri-loader-4-line spin"></i> Buscando anfitriões...</div>'
      elements.hostResults.classList.add('show')

      searchTimeout = setTimeout(async () => {
        try {
          const q = query(collection(db, 'funcionarios'), orderBy('nome'))
          const querySnapshot = await getDocs(q)

          elements.hostResults.innerHTML = ''

          if (querySnapshot.empty) {
            elements.hostResults.innerHTML =
              '<div class="result-item">Nenhum anfitrião encontrado</div>'
          } else {
            querySnapshot.forEach((doc) => {
              const funcionario = doc.data()
              if (funcionario.nome.toLowerCase().includes(searchTerm)) {
                const item = document.createElement('div')
                item.className = 'result-item'
                item.innerHTML = `<strong>${funcionario.nome}</strong>`

                item.addEventListener('click', () => {
                  elements.hostInput.value = funcionario.nome
                  elements.hostResults.classList.remove('show')
                })

                elements.hostResults.appendChild(item)
              }
            })
          }
        } catch (error) {
          console.error('Erro na busca:', error)
          elements.hostResults.innerHTML = `
            <div class="error-results">
              <i class="ri-error-warning-line"></i> Erro na busca
            </div>
          `
        }
      }, 300)
    })

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-container')) {
        elements.hostResults.classList.remove('show')
      }
    })
  }

  async function loadConvidados(filtro = '') {
    const tbody = document.querySelector('#convidados .records-table tbody')
    const summaryInfo = document.querySelector('#convidados .summary-info')

    if (!tbody || !summaryInfo) return

    tbody.innerHTML = `<tr><td colspan="5" class="loading-row"><i class="ri-loader-4-line spin"></i> Carregando...</td></tr>`

    try {
      const q = query(collection(db, 'convidados'), orderBy('criadoEm', 'desc'))
      const querySnapshot = await getDocs(q)

      const filteredData = []
      const searchTerm = filtro.toLowerCase().trim()

      querySnapshot.forEach((doc) => {
        const data = doc.data()
        if (
          searchTerm === '' ||
          (data.nome && data.nome.toLowerCase().includes(searchTerm)) ||
          (data.empresa && data.empresa.toLowerCase().includes(searchTerm))
        ) {
          filteredData.push({
            id: doc.id,
            ...data,
            criadoEm: data.criadoEm.toDate(),
          })
        }
      })

      const startIndex = (currentPage - 1) * pageSize
      const paginatedData = filteredData.slice(startIndex, startIndex + pageSize)

      renderConvidados(tbody, paginatedData, filtro)
      updatePagination(summaryInfo, filteredData.length)
      updatePaginationControls(filteredData.length)
    } catch (error) {
      console.error('Erro ao carregar convidados:', error)
      tbody.innerHTML = `<tr><td colspan="5" class="error-row"><i class="ri-error-warning-line"></i> Erro ao carregar dados</td></tr>`
    }
  }

  function renderConvidados(tbody, data, filtro) {
    tbody.innerHTML = ''

    if (data.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="5" class="empty-row">
          <i class="ri-user-search-line"></i>
          ${filtro ? 'Nenhum resultado encontrado' : 'Nenhum convidado cadastrado'}
        </td></tr>
      `
    } else {
      data.forEach((item) => {
        tbody.innerHTML += `
          <tr data-id="${item.id}">
            <td><strong>${item.nome}</strong></td>
            <td>${item.empresa}</td>
            <td>${formatCPFDisplay(item.cpf)}</td>
            <td>${item.telefone}</td>
            <td>${item.criadoEm.toLocaleDateString('pt-BR')}</td>
          </tr>
        `
      })
    }
  }

  async function carregarVisitasAtivas() {
    const tbody = document.querySelector('.data-panel .records-table tbody')
    if (!tbody) {
      console.error('Tabela de visitas ativas não encontrada no DOM!')
      return
    }

    tbody.innerHTML =
      '<tr><td colspan="7" class="loading-row"><i class="ri-loader-4-line spin"></i> Carregando visitantes ativos...</td></tr>'

    try {
      const q = query(
        collection(db, 'visitas'),
        where('status', '==', 'ativo'),
        orderBy('checkIn', 'desc'),
      )
      const querySnapshot = await getDocs(q)

      document.querySelector('.metric-card:nth-child(2) .metric-value').textContent =
        querySnapshot.size

      tbody.innerHTML = ''

      if (querySnapshot.empty) {
        tbody.innerHTML =
          '<tr><td colspan="7" class="empty-row"><i class="ri-user-search-line"></i> Nenhum visitante ativo no momento</td></tr>'
        return
      }

      querySnapshot.forEach((doc) => {
        const visita = doc.data()
        const checkInDate = visita.checkIn?.toDate()

        tbody.innerHTML += `
                <tr data-id="${doc.id}">
                    <td><div class="visitor-info"><strong>${visita.convidadoNome || 'N/A'}</strong></div></td>
                    <td>${visita.cracha || 'N/A'}</td>
                    <td>${visita.motivoVisita || 'N/A'}</td>
                    <td>${visita.anfitriao || 'N/A'}</td>
                    <td>${checkInDate?.toLocaleTimeString('pt-BR') || 'N/A'}</td>
                    <td>${calcularTempoDecorrido(checkInDate) || 'N/A'}</td>
                    <td><button class="btn small-btn danger-btn checkout-btn">Check-out</button></td>
                </tr>
            `
      })

      adicionarEventosCheckOut()

      const remaining = querySnapshot.size
      const summaryInfo = document.querySelector('.data-panel .table-summary .summary-info')
      if (summaryInfo) {
        summaryInfo.textContent = `Mostrando 1 de ${remaining} visitantes ativos`
      }
    } catch (error) {
      console.error('Erro ao carregar visitas ativas:', error)
      document.querySelector('.metric-card:nth-child(2) .metric-value').textContent = 'Erro'
      tbody.innerHTML =
        '<tr><td colspan="7" class="error-row"><i class="ri-error-warning-line"></i> Erro ao carregar dados</td></tr>'
    }
  }

  async function carregarHistoricoVisitas(filtro = '') {
    const tbody = document.querySelector('#registros .records-table tbody')
    if (!tbody) return

    tbody.innerHTML =
      '<tr><td colspan="7" class="loading-row"><i class="ri-loader-4-line spin"></i> Carregando histórico...</td></tr>'

    try {
      const q = query(collection(db, 'visitas'), orderBy('checkIn', 'desc'))
      const querySnapshot = await getDocs(q)

      todasVisitas = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        checkIn: doc.data().checkIn?.toDate(),
        checkOut: doc.data().checkOut?.toDate(),
      }))

      const visitasFiltradas = aplicarFiltro(todasVisitas, filtro)
      renderizarVisitas(tbody, visitasFiltradas)
    } catch (error) {
      console.error('Erro ao carregar histórico de visitas:', error)
      tbody.innerHTML =
        '<tr><td colspan="7" class="error-row"><i class="ri-error-warning-line"></i> Erro ao carregar dados</td></tr>'
    }
  }

  function aplicarFiltro(visitas, filtro) {
    if (!filtro) return visitas

    const termo = filtro.toLowerCase()
    return visitas.filter(
      (visita) =>
        (visita.convidadoNome && visita.convidadoNome.toLowerCase().includes(termo)) ||
        (visita.cracha && visita.cracha.toLowerCase().includes(termo)) ||
        (visita.motivoVisita && visita.motivoVisita.toLowerCase().includes(termo)) ||
        (visita.anfitriao && visita.anfitriao.toLowerCase().includes(termo)),
    )
  }

  function renderizarVisitas(tbody, visitas) {
    tbody.innerHTML = ''

    if (visitas.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="empty-row"><i class="ri-user-search-line"></i> Nenhuma visita encontrada</td></tr>'
      return
    }

    visitas.forEach((visita) => {
      const checkInFormatado = visita.checkIn
        ? `<div>${visita.checkIn.toLocaleDateString('pt-BR')}</div>
         <div class="secondary-text">${visita.checkIn.toLocaleTimeString('pt-BR')}</div>`
        : '<div>-</div><div class="secondary-text">-</div>'

      const checkOutFormatado = visita.checkOut
        ? `<div>${visita.checkOut.toLocaleDateString('pt-BR')}</div>
         <div class="secondary-text">${visita.checkOut.toLocaleTimeString('pt-BR')}</div>`
        : '<div>-</div><div class="secondary-text">-</div>'

      const duracao =
        visita.status === 'finalizado' && visita.checkIn && visita.checkOut
          ? calcularDuracaoVisita(visita.checkIn, visita.checkOut)
          : '<span class="status-tag warning-tag">Em andamento</span>'

      tbody.innerHTML += `
        <tr data-id="${visita.id}">
          <td><strong>${visita.convidadoNome || 'N/A'}</strong></td>
          <td>${visita.cracha || 'N/A'}</td>
          <td>${checkInFormatado}</td>
          <td>${checkOutFormatado}</td>
          <td>${duracao}</td>
          <td>${formatarMotivoVisita(visita.motivoVisita) || 'N/A'}</td>
          <td>${visita.anfitriao || 'N/A'}</td>
        </tr>
      `
    })

    const total = visitas.length
    const summaryInfo = document.querySelector('#registros .summary-info')
    if (summaryInfo) {
      summaryInfo.textContent = `Mostrando 1-${total} de ${total} registros`
    }
  }

  async function exportConvidadosToXLSX() {
    try {
      const q = query(collection(db, 'convidados'), orderBy('criadoEm', 'desc'))
      const querySnapshot = await getDocs(q)

      const data = querySnapshot.docs.map((doc) => {
        const convidado = doc.data()
        return {
          Nome: convidado.nome,
          Empresa: convidado.empresa,
          CPF: formatCPFDisplay(convidado.cpf),
          Telefone: convidado.telefone,
          'Data de Cadastro': convidado.criadoEm.toDate().toLocaleDateString('pt-BR'),
        }
      })

      const worksheet = XLSX.utils.json_to_sheet(data)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Convidados')
      XLSX.writeFile(workbook, 'convidados.xlsx')
    } catch (error) {
      console.error('Erro ao exportar:', error)
      showAlert('Erro ao exportar dados!', 'error')
    }
  }

  async function exportVisitasToXLSX() {
    try {
      const visitasParaExportar =
        todasVisitas.length > 0 ? todasVisitas : await buscarTodasVisitas()

      const dadosFormatados = visitasParaExportar.map((visita) => ({
        Nome: visita.convidadoNome || 'N/A',
        Crachá: visita.cracha || 'N/A',
        'Check-in': visita.checkIn ? visita.checkIn.toLocaleString('pt-BR') : 'N/A',
        'Check-out': visita.checkOut ? visita.checkOut.toLocaleString('pt-BR') : 'N/A',
        Duração:
          visita.checkIn && visita.checkOut
            ? calcularDuracaoVisita(visita.checkIn, visita.checkOut)
            : 'Em andamento',
        Motivo: formatarMotivoVisita(visita.motivoVisita) || 'N/A',
        Anfitrião: visita.anfitriao || 'N/A',
        Status: visita.status === 'finalizado' ? 'Finalizado' : 'Ativo',
      }))

      const worksheet = XLSX.utils.json_to_sheet(dadosFormatados)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Histórico de Visitas')

      const hoje = new Date()
      const dataFormatada = hoje.toISOString().split('T')[0]
      XLSX.writeFile(workbook, `historico_visitas_${dataFormatada}.xlsx`)
    } catch (error) {
      console.error('Erro ao exportar histórico:', error)
      showAlert('Erro ao exportar dados!', 'error')
    }
  }

  async function buscarTodasVisitas() {
    try {
      const q = query(collection(db, 'visitas'), orderBy('checkIn', 'desc'))
      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        checkIn: doc.data().checkIn?.toDate(),
        checkOut: doc.data().checkOut?.toDate(),
      }))
    } catch (error) {
      console.error('Erro ao buscar visitas:', error)
      return []
    }
  }

  async function atualizarMetricas() {
    await Promise.all([
      atualizarTotalConvidados(),
      atualizarVisitasAtivas(),
      atualizarVisitasHoje(),
      atualizarVisitasSemana(),
    ])
  }

  async function atualizarTotalConvidados() {
    try {
      const querySnapshot = await getDocs(collection(db, 'convidados'))
      elements.metricCards[0].textContent = querySnapshot.size
    } catch (error) {
      console.error('Erro ao buscar total de convidados:', error)
      elements.metricCards[0].textContent = 'Erro'
    }
  }

  async function atualizarVisitasAtivas() {
    try {
      const q = query(collection(db, 'visitas'), where('status', '==', 'ativo'))
      const querySnapshot = await getDocs(q)
      elements.metricCards[1].textContent = querySnapshot.size
    } catch (error) {
      console.error('Erro ao buscar visitas ativas:', error)
      elements.metricCards[1].textContent = 'Erro'
    }
  }

  async function atualizarVisitasHoje() {
    try {
      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)

      const q = query(collection(db, 'visitas'), where('checkIn', '>=', Timestamp.fromDate(hoje)))
      const querySnapshot = await getDocs(q)
      elements.metricCards[2].textContent = querySnapshot.size
    } catch (error) {
      console.error('Erro ao buscar visitas hoje:', error)
      elements.metricCards[2].textContent = 'Erro'
    }
  }

  async function atualizarVisitasSemana() {
    try {
      const hoje = new Date()
      const inicioSemana = new Date(hoje)
      inicioSemana.setDate(hoje.getDate() - hoje.getDay())

      const q = query(
        collection(db, 'visitas'),
        where('checkIn', '>=', Timestamp.fromDate(inicioSemana)),
      )
      const querySnapshot = await getDocs(q)
      elements.metricCards[3].textContent = querySnapshot.size
    } catch (error) {
      console.error('Erro ao buscar visitas da semana:', error)
      elements.metricCards[3].textContent = 'Erro'
    }
  }

  function formatCPFInput(e) {
    let value = e.target.value.replace(/\D/g, '')
    if (value.length > 3) value = `${value.substring(0, 3)}.${value.substring(3)}`
    if (value.length > 7) value = `${value.substring(0, 7)}.${value.substring(7)}`
    if (value.length > 11) value = `${value.substring(0, 11)}-${value.substring(11, 13)}`
    e.target.value = value.substring(0, 14)
  }

  function formatPhoneInput(e) {
    let value = e.target.value.replace(/\D/g, '')
    if (value.length > 0)
      value = `(${value.substring(0, 2)}${value.length > 2 ? ') ' : ''}${value.substring(2)}`
    if (value.length > 10) value = `${value.substring(0, 10)}-${value.substring(10, 14)}`
    e.target.value = value.substring(0, 15)
  }

  function formatCPFDisplay(cpf) {
    if (!cpf) return ''
    const cleaned = cpf.replace(/\D/g, '')
    return cleaned.length === 11
      ? `${cleaned.substring(0, 3)}.${cleaned.substring(3, 6)}.${cleaned.substring(6, 9)}-${cleaned.substring(9, 11)}`
      : cpf
  }

  function showAlert(message, type = 'info') {
    const alertBox = document.createElement('div')
    alertBox.className = `alert-box ${type}`
    alertBox.innerHTML = `
      <i class="ri-${type === 'error' ? 'close-circle' : type === 'success' ? 'checkbox-circle' : 'information'}"></i>
      <span>${message}</span>
      <i class="ri-close-line close-alert"></i>
    `

    document.body.appendChild(alertBox)
    alertBox.querySelector('.close-alert').addEventListener('click', () => dismissAlert(alertBox))
    setTimeout(() => dismissAlert(alertBox), 5000)
  }

  function dismissAlert(alertBox) {
    alertBox.classList.add('fade-out')
    setTimeout(() => alertBox.remove(), 300)
  }

  function updatePagination(summaryInfo, totalCount) {
    const startItem = (currentPage - 1) * pageSize + 1
    const endItem = Math.min(currentPage * pageSize, totalCount)

    summaryInfo.textContent = `Mostrando ${startItem}-${endItem} de ${totalCount} resultado${totalCount !== 1 ? 's' : ''}`
  }

  function updatePaginationControls(totalCount) {
    const totalPages = Math.ceil(totalCount / pageSize)

    if (elements.prevPageBtn) {
      elements.prevPageBtn.disabled = currentPage <= 1
    }

    if (elements.nextPageBtn) {
      elements.nextPageBtn.disabled = currentPage >= totalPages
    }
  }

  function adicionarEventosCheckOut() {
    document.querySelectorAll('.checkout-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const row = e.target.closest('tr')
        const visitaId = row.dataset.id

        try {
          e.target.innerHTML = '<i class="ri-loader-4-line spin"></i>'
          e.target.disabled = true

          await updateDoc(doc(db, 'visitas', visitaId), {
            status: 'finalizado',
            checkOut: Timestamp.now(),
          })

          showAlert('Check-out realizado com sucesso!', 'success')
          row.remove()

          const remaining = document.querySelectorAll(
            '#registrar-visita .records-table tbody tr',
          ).length
          document.querySelector('#registrar-visita .summary-info').textContent =
            `Mostrando ${remaining} de ${remaining} visitantes ativos`

          if (document.querySelector('#registros').style.display === 'block') {
            carregarHistoricoVisitas()
          }

          atualizarMetricas()
        } catch (error) {}
      })
    })
  }

  function calcularTempoDecorrido(dataCheckIn) {
    const agora = new Date()
    const diffMs = agora - dataCheckIn
    const diffMins = Math.round(diffMs / 60000)

    if (diffMins < 60) {
      return `${diffMins} min`
    } else {
      const hours = Math.floor(diffMins / 60)
      const mins = diffMins % 60
      return `${hours}h ${mins}min`
    }
  }

  function calcularDuracaoVisita(checkIn, checkOut) {
    const diffMs = checkOut - checkIn
    const diffMins = Math.round(diffMs / 60000)

    if (diffMins < 60) {
      return `${diffMins} min`
    } else {
      const hours = Math.floor(diffMins / 60)
      const mins = diffMins % 60
      return `${hours}h ${mins}min`
    }
  }

  function formatarMotivoVisita(motivo) {
    const motivos = {
      reuniao: 'Reunião',
      entrega: 'Entrega',
      manutencao: 'Manutenção',
      visita: 'Visita',
      outro: 'Outro',
    }
    return motivos[motivo] || motivo
  }

  async function limparRegistrosAntigos() {
    try {
      const seisMesesAtras = new Date()
      seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6)

      console.log('[TESTE] Limpando registros anteriores a:', seisMesesAtras.toLocaleDateString())

      const visitasRef = collection(db, 'visitas')
      const qVisitas = query(visitasRef, where('checkIn', '<', Timestamp.fromDate(seisMesesAtras)))
      const querySnapshotVisitas = await getDocs(qVisitas)

      const convidadosRef = collection(db, 'convidados')
      const qConvidados = query(
        convidadosRef,
        where('criadoEm', '<', Timestamp.fromDate(seisMesesAtras)),
      )
      const querySnapshotConvidados = await getDocs(qConvidados)

      const batch = writeBatch(db)
      querySnapshotVisitas.forEach((doc) => batch.delete(doc.ref))
      querySnapshotConvidados.forEach((doc) => batch.delete(doc.ref))

      if (querySnapshotVisitas.size > 0 || querySnapshotConvidados.size > 0) {
        await batch.commit()
        console.log(`[TESTE] Removidos:
      - Visitas: ${querySnapshotVisitas.size}
      - Convidados: ${querySnapshotConvidados.size}`)
      } else {
        console.log('[TESTE] Nada para limpar.')
      }
    } catch (error) {
      console.error('[TESTE] Erro:', error)
    }
  }

  async function verificarCrachaEmUso(cracha) {
    try {
      const q = query(
        collection(db, 'visitas'),
        where('cracha', '==', cracha),
        where('status', '==', 'ativo'),
      )
      const querySnapshot = await getDocs(q)
      return !querySnapshot.empty
    } catch (error) {
      console.error('Erro ao verificar crachá:', error)
      return false
    }
  }

  const badgeInput = document.getElementById('visitor-badge')
  const badgeStatus = document.createElement('div')
  badgeStatus.className = 'badge-status'
  badgeInput.parentNode.appendChild(badgeStatus)

  badgeInput.addEventListener('input', async () => {
    const cracha = badgeInput.value.trim()
    if (cracha.length >= 6) {
      const emUso = await verificarCrachaEmUso(cracha)
      badgeStatus.innerHTML = emUso
        ? '<i class="ri-close-fill" style="color: red"></i> Em uso'
        : '<i class="ri-check-fill" style="color: green"></i> Disponível'
    } else {
      badgeStatus.innerHTML = ''
    }
  })

  setInterval(
    () => {
      limparRegistrosAntigos()
    },
    1000 * 60 * 60 * 24,
  )

  async function loadDashboardData() {
    const startTime = Date.now()
    const minDisplayTime = 1000

    try {
      await Promise.all([atualizarMetricas(), carregarVisitasAtivas(), carregarHistoricoVisitas()])
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      const elapsed = Date.now() - startTime
      const remainingTime = Math.max(0, minDisplayTime - elapsed)

      setTimeout(() => {
        const loadingScreen = document.getElementById('loadingScreen')
        if (loadingScreen) {
          loadingScreen.classList.add('hidden')
        }
      }, remainingTime)
    }
  }

  setupEventListeners()
  showPage('dashboard')
  atualizarMetricas()

  setInterval(atualizarMetricas, 300000)
})
