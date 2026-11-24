const formatRupiah = (num) => 'Rp ' + Number(num).toLocaleString('id-ID');

// Ganti dengan nomor WhatsApp Admin Bakery (awali dengan 62, tanpa tanda + atau 0 di depan)
const ADMIN_WHATSAPP = '6281234567890';

// ==========================================
// 0. MODE GELAP & MODE TERANG (TOMBOL IKON)
// ==========================================
const THEME_KEY = 'live_catalog_theme_v1';

const MOON_ICON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z"></path>
  </svg>
`;

const SUN_ICON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4"></circle>
    <path d="M12 2v2"></path>
    <path d="M12 20v2"></path>
    <path d="m4.93 4.93 1.41 1.41"></path>
    <path d="m17.66 17.66 1.41 1.41"></path>
    <path d="M2 12h2"></path>
    <path d="M20 12h2"></path>
    <path d="m6.34 17.66-1.41 1.41"></path>
    <path d="m19.07 4.93-1.41 1.41"></path>
  </svg>
`;

function getPreferredTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function syncThemeButtons(theme) {
  const isDark = theme === 'dark';
  document.querySelectorAll('#themeToggleBtn, #themeToggleLoginBtn').forEach((btn) => {
    btn.innerHTML = isDark ? SUN_ICON : MOON_ICON;
    btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
  });
}

function applyTheme(theme) {
  const validTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', validTheme);
  localStorage.setItem(THEME_KEY, validTheme);
  syncThemeButtons(validTheme);
}

applyTheme(getPreferredTheme());

document.querySelectorAll('#themeToggleBtn, #themeToggleLoginBtn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
});

function showToast(message) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function readImageFileAsCompressedDataUrl(file, maxSize = 640, quality = 0.78) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Pilih file gambar roti yang valid (JPG, PNG, WEBP, dll).'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width >= height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const dataUrl = mime === 'image/png'
          ? canvas.toDataURL('image/png')
          : canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Gagal memproses foto roti.'));
      img.src = ev.target.result;
    };
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });
}

// ==========================================
// 1. HALAMAN MENU ROTI PUBLIK (index.html)
// ==========================================
const catalogGrid = document.getElementById('catalogGrid');
if (catalogGrid) {
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const gridViewBtn = document.getElementById('gridViewBtn');
  const listViewBtn = document.getElementById('listViewBtn');
  const syncIndicator = document.getElementById('syncIndicator');
  const heroProductCount = document.getElementById('heroProductCount');
  const resultCountLabel = document.getElementById('resultCountLabel');
  const backToTopBtn = document.getElementById('backToTopBtn');

  const imageLightbox = document.getElementById('imageLightbox');
  const closeLightboxBtn = document.getElementById('closeLightboxBtn');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxTitle = document.getElementById('lightboxTitle');
  const lightboxPrice = document.getElementById('lightboxPrice');

  const productDetailModal = document.getElementById('productDetailModal');
  const closeDetailModalBtn = document.getElementById('closeDetailModalBtn');
  const detailModalPhotoWrap = document.getElementById('detailModalPhotoWrap');
  const detailModalImg = document.getElementById('detailModalImg');
  const detailModalBadge = document.getElementById('detailModalBadge');
  const detailModalTitle = document.getElementById('detailModalTitle');
  const detailModalDesc = document.getElementById('detailModalDesc');
  const detailModalPrice = document.getElementById('detailModalPrice');
  const detailOrderBtn = document.getElementById('detailOrderBtn');
  const detailCopyBtn = document.getElementById('detailCopyBtn');

  let activeDetailProduct = null;

  function buildOrderMessage(product) {
    return (
      `Halo Admin RotiKita Bakery, saya ingin memesan roti berikut:\n\n` +
      `• *Roti:* ${product.name}\n` +
      `• *Harga:* ${formatRupiah(product.price)}\n\n` +
      `Mohon info ketersediaan stok dan proses pembayarannya. Terima kasih!`
    );
  }

  function openGeneralWhatsApp() {
    const message =
      `Halo Admin RotiKita Bakery, saya ingin bertanya tentang menu roti dan ketersediaan pesanan. Terima kasih!`;
    window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(message)}`, '_blank');
  }

  document.getElementById('heroCustomAskBtn')?.addEventListener('click', openGeneralWhatsApp);
  document.getElementById('ctaCustomBtn')?.addEventListener('click', () => {
    const message =
      `Halo Admin RotiKita Bakery, saya ingin memesan roti / snack box untuk acara. Mohon info katalog paket dan jadwalnya. Terima kasih!`;
    window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(message)}`, '_blank');
  });

  function setCatalogView(mode) {
    const isList = mode === 'list';
    catalogGrid.classList.toggle('list-mode', isList);
    gridViewBtn?.classList.toggle('active', !isList);
    listViewBtn?.classList.toggle('active', isList);
  }

  gridViewBtn?.addEventListener('click', () => setCatalogView('grid'));
  listViewBtn?.addEventListener('click', () => setCatalogView('list'));

  function openLightbox(product) {
    if (!imageLightbox || !product?.image) return;
    lightboxImg.src = product.image;
    lightboxImg.alt = product.name || 'Foto Roti';
    lightboxTitle.textContent = product.name || 'Roti';
    lightboxPrice.textContent = formatRupiah(product.price || 0);
    imageLightbox.style.display = 'grid';
  }

  function closeLightbox() {
    if (!imageLightbox) return;
    imageLightbox.style.display = 'none';
    lightboxImg.src = '';
  }

  function openProductDetail(product, indexNumber) {
    if (!productDetailModal || !product) return;
    activeDetailProduct = product;

    if (product.image) {
      detailModalImg.src = product.image;
      detailModalImg.alt = product.name || 'Foto Roti';
      detailModalPhotoWrap.style.display = 'block';
    } else {
      detailModalImg.src = '';
      detailModalPhotoWrap.style.display = 'none';
    }

    detailModalBadge.textContent = `#${String(indexNumber).padStart(2, '0')}`;
    detailModalTitle.textContent = product.name || 'Roti';
    detailModalDesc.textContent = product.desc || 'Roti segar pilihan siap dipesan langsung ke admin.';
    detailModalPrice.textContent = formatRupiah(product.price || 0);
    productDetailModal.style.display = 'grid';
  }

  function closeProductDetail() {
    if (!productDetailModal) return;
    productDetailModal.style.display = 'none';
    activeDetailProduct = null;
  }

  window.previewProductPhoto = (id) => {
    const product = SyncEngine.getProducts().find((p) => p.id === id);
    if (product && product.image) openLightbox(product);
  };

  window.showProductDetail = (id) => {
    const list = getFilteredProducts(SyncEngine.getProducts());
    const idx = list.findIndex((p) => p.id === id);
    if (idx !== -1) openProductDetail(list[idx], idx + 1);
  };

  detailOrderBtn?.addEventListener('click', () => {
    if (activeDetailProduct) window.orderProduct(activeDetailProduct.id);
  });

  detailCopyBtn?.addEventListener('click', async () => {
    if (!activeDetailProduct) return;
    const text = buildOrderMessage(activeDetailProduct);
    try {
      await navigator.clipboard.writeText(text);
      showToast('Format pesanan roti berhasil disalin!');
    } catch {
      showToast('Gagal menyalin teks ke clipboard.');
    }
  });

  closeLightboxBtn?.addEventListener('click', closeLightbox);
  imageLightbox?.addEventListener('click', (e) => {
    if (e.target === imageLightbox) closeLightbox();
  });

  closeDetailModalBtn?.addEventListener('click', closeProductDetail);
  productDetailModal?.addEventListener('click', (e) => {
    if (e.target === productDetailModal) closeProductDetail();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (imageLightbox?.style.display === 'grid') closeLightbox();
      if (productDetailModal?.style.display === 'grid') closeProductDetail();
    }
  });

  window.addEventListener('scroll', () => {
    if (!backToTopBtn) return;
    backToTopBtn.classList.toggle('is-visible', window.scrollY > 360);
  });

  backToTopBtn?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  function getFilteredProducts(products) {
    const keyword = (searchInput.value || '').trim().toLowerCase();
    return products.filter((p) =>
      (p.name || '').toLowerCase().includes(keyword) ||
      (p.desc || '').toLowerCase().includes(keyword)
    );
  }

  function renderCatalog(products) {
    const safeProducts = Array.isArray(products) ? products : [];
    if (heroProductCount) {
      heroProductCount.textContent = safeProducts.length;
    }

    const keyword = (searchInput.value || '').trim();
    if (clearSearchBtn) {
      clearSearchBtn.style.display = keyword ? 'inline-flex' : 'none';
    }

    const filtered = getFilteredProducts(safeProducts);
    if (resultCountLabel) {
      resultCountLabel.textContent = `Menampilkan ${filtered.length} dari ${safeProducts.length} varian roti`;
    }

    if (filtered.length === 0) {
      catalogGrid.innerHTML = `
        <div class="card admin-empty" style="grid-column: 1 / -1;">
          ${keyword ? `Tidak ada roti yang cocok dengan kata kunci "${escapeHtml(keyword)}".` : 'Belum ada varian roti yang ditampilkan.'}
        </div>
      `;
      return;
    }

    catalogGrid.innerHTML = filtered.map((p, idx) => {
      const safeName = escapeHtml(p.name);
      const safeDesc = escapeHtml(p.desc || 'Roti segar pilihan siap dipesan langsung ke admin.');

      const photoHtml = p.image
        ? `
          <div class="product-thumb-wrap">
            <img src="${p.image}" alt="${safeName}" class="product-thumb" onclick="previewProductPhoto('${p.id}')" />
          </div>
        `
        : '';

      const zoomBtnHtml = p.image
        ? `<button type="button" class="zoom-photo-btn" onclick="previewProductPhoto('${p.id}')">Foto Penuh</button>`
        : `<span></span>`;

      return `
        <article class="product-card">
          <div class="card-body-top">
            ${photoHtml}
            <div style="flex:1; min-width:0;">
              <div class="card-meta-row">
                <span class="item-index">#${String(idx + 1).padStart(2, '0')}</span>
                ${zoomBtnHtml}
              </div>
              <h3 class="product-title" onclick="showProductDetail('${p.id}')">${safeName}</h3>
              <p class="product-desc">${safeDesc}</p>
            </div>
          </div>
          <div class="card-body-bottom">
            <div class="price-box">
              <span class="price-label">Harga</span>
              <span class="price-current">${formatRupiah(p.price)}</span>
            </div>
            <div class="card-action-row">
              <button type="button" class="btn btn-outline" onclick="showProductDetail('${p.id}')">Detail</button>
              <button type="button" class="btn btn-primary" style="flex:1;" onclick="orderProduct('${p.id}')">
                Pesan Roti
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  window.orderProduct = (id) => {
    const product = SyncEngine.getProducts().find((p) => p.id === id);
    if (!product) {
      showToast('Varian roti tidak ditemukan.');
      return;
    }

    const message = buildOrderMessage(product);
    const waUrl = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  SyncEngine.onUpdate((updatedProducts) => {
    renderCatalog(updatedProducts);
    if (syncIndicator) {
      syncIndicator.classList.add('pulse');
      setTimeout(() => syncIndicator.classList.remove('pulse'), 1500);
    }
    showToast('Menu roti telah diperbarui oleh Admin!');
  });

  searchInput.addEventListener('input', () => renderCatalog(SyncEngine.getProducts()));
  clearSearchBtn?.addEventListener('click', () => {
    searchInput.value = '';
    renderCatalog(SyncEngine.getProducts());
    searchInput.focus();
  });

  renderCatalog(SyncEngine.getProducts());
}

// ==========================================
// 2. HALAMAN ADMIN TERPROTEKSI (admin.html)
// ==========================================
const authGate = document.getElementById('authGate');
const adminPanel = document.getElementById('adminPanel');

if (authGate && adminPanel) {
  const loginForm = document.getElementById('loginForm');
  const productForm = document.getElementById('productForm');
  const adminList = document.getElementById('adminProductList');
  const totalCount = document.getElementById('totalCount');
  const formTitle = document.getElementById('formTitle');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const prodImageFile = document.getElementById('prodImageFile');
  const imagePreviewWrap = document.getElementById('imagePreviewWrap');
  const imagePreview = document.getElementById('imagePreview');
  const removeImageBtn = document.getElementById('removeImageBtn');

  let currentImageData = '';

  function setImagePreview(dataUrl) {
    currentImageData = dataUrl || '';
    if (currentImageData) {
      imagePreview.src = currentImageData;
      imagePreviewWrap.style.display = 'flex';
    } else {
      imagePreview.src = '';
      imagePreviewWrap.style.display = 'none';
      prodImageFile.value = '';
    }
  }

  prodImageFile.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await readImageFileAsCompressedDataUrl(file);
      setImagePreview(compressed);
    } catch (err) {
      showToast(err.message);
      prodImageFile.value = '';
    }
  });

  removeImageBtn.addEventListener('click', () => {
    setImagePreview('');
  });

  function unlockAdminUI() {
    authGate.style.display = 'none';
    adminPanel.style.display = 'block';
    renderAdminList(SyncEngine.getProducts());
  }

  if (SyncEngine.isAdminAuthenticated()) {
    unlockAdminUI();
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('adminEmailInput').value;
    const password = document.getElementById('adminPasswordInput').value;

    try {
      await SyncEngine.loginAdmin(email, password);
      unlockAdminUI();
      showToast('Login admin bakery berhasil!');
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    SyncEngine.logoutAdmin();
    location.reload();
  });

  function renderAdminList(products) {
    totalCount.textContent = products.length;

    if (products.length === 0) {
      adminList.innerHTML = `
        <div class="admin-empty">
          Daftar menu roti masih kosong. Tambahkan varian roti baru di form sebelah kiri.
        </div>
      `;
      return;
    }

    adminList.innerHTML = products.map((p) => {
      const safeName = escapeHtml(p.name);
      const thumbHtml = p.image
        ? `<img src="${p.image}" alt="${safeName}" class="admin-thumb" />`
        : '';

      return `
        <div class="admin-item">
          <div class="admin-item-left">
            ${thumbHtml}
            <div>
              <strong>${safeName}</strong>
              <div class="admin-item-meta">
                Harga: ${formatRupiah(p.price)}
              </div>
            </div>
          </div>
          <div class="admin-item-actions">
            <button type="button" class="btn btn-outline btn-xs" onclick="duplicateProduct('${p.id}')">Duplikat</button>
            <button type="button" class="btn btn-outline btn-xs" onclick="editProduct('${p.id}')">Edit</button>
            <button type="button" class="btn btn-danger-sm" onclick="deleteProduct('${p.id}')">Hapus</button>
          </div>
        </div>
      `;
    }).join('');
  }

  window.duplicateProduct = async (id) => {
    const products = SyncEngine.getProducts();
    const source = products.find((p) => p.id === id);
    if (!source) return;

    const cloned = {
      ...source,
      id: 'roti-' + Date.now(),
      name: `${source.name} (Salinan)`
    };

    products.unshift(cloned);
    try {
      await SyncEngine.saveProducts(products);
      showToast(`Varian "${source.name}" berhasil diduplikat!`);
    } catch (err) {
      showToast(err.message);
    }
  };

  productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const products = SyncEngine.getProducts();
    const id = document.getElementById('prodId').value;

    const itemData = {
      id: id || 'roti-' + Date.now(),
      name: document.getElementById('prodName').value.trim(),
      price: Number(document.getElementById('prodPrice').value),
      image: currentImageData || '',
      desc: document.getElementById('prodDesc').value.trim()
    };

    if (id) {
      const idx = products.findIndex((p) => p.id === id);
      if (idx !== -1) products[idx] = itemData;
    } else {
      products.unshift(itemData);
    }

    try {
      await SyncEngine.saveProducts(products);
      showToast('Menu roti berhasil disimpan & dikirim ke semua pelanggan!');
      resetForm();
    } catch (err) {
      showToast(err.message);
    }
  });

  window.editProduct = (id) => {
    const p = SyncEngine.getProducts().find((item) => item.id === id);
    if (!p) return;
    document.getElementById('prodId').value = p.id;
    document.getElementById('prodName').value = p.name;
    document.getElementById('prodPrice').value = p.price;
    document.getElementById('prodDesc').value = p.desc || '';
    setImagePreview(p.image || '');

    formTitle.textContent = 'Edit Varian Roti';
    cancelEditBtn.style.display = 'inline-flex';
  };

  window.deleteProduct = async (id) => {
    const target = SyncEngine.getProducts().find((p) => p.id === id);
    const label = target ? `"${target.name}"` : 'varian roti ini';
    if (!confirm(`Yakin ingin menghapus ${label} dari menu?`)) return;

    const filtered = SyncEngine.getProducts().filter((p) => p.id !== id);
    try {
      await SyncEngine.saveProducts(filtered);
      showToast('Varian roti dihapus dari menu!');
    } catch (err) {
      showToast(err.message);
    }
  };

  function resetForm() {
    productForm.reset();
    document.getElementById('prodId').value = '';
    setImagePreview('');
    formTitle.textContent = 'Tambah Varian Roti Baru';
    cancelEditBtn.style.display = 'none';
  }

  cancelEditBtn.addEventListener('click', resetForm);

  document.getElementById('resetDefaultBtn').addEventListener('click', async () => {
    if (!confirm('Yakin ingin mengosongkan seluruh daftar roti?')) return;
    try {
      await SyncEngine.resetToDefault();
      showToast('Daftar roti dikosongkan.');
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById('exportBtn').addEventListener('click', () => {
    const dataStr = JSON.stringify(SyncEngine.getProducts(), null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `menu-roti-backup-${Date.now()}.json`;
    a.click();
  });

  document.getElementById('importInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (Array.isArray(imported)) {
          await SyncEngine.saveProducts(imported);
          showToast('Backup menu roti berhasil diimpor!');
        }
      } catch (err) {
        showToast(err.message || 'Format file JSON tidak valid.');
      }
    };
    reader.readAsText(file);
  });

  SyncEngine.onUpdate(renderAdminList);
}