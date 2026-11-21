const cafe = window.CAFE_CONFIG;
const productList = document.querySelector("#product-list");
const menuCount = document.querySelector("#menu-count");
const categoryTabs = [...document.querySelectorAll(".category-tab")];
const offerButton = document.querySelector("#offer-button");
const offerModal = document.querySelector("#offer-modal");
const offerImage = document.querySelector("#offer-image");
const productPreview = document.querySelector("#product-preview");
const previewImage = document.querySelector("#preview-image");
const productsCsvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ_CmvGkiXCbCNY3kcb4wIkms4cDMFLawslQwjK2uza9LxKuDBU9RIPBNM53FefI6PtPHV-9bsZguc5/pub?output=csv";

let activeCategory = "hot";
let products = [];

function setText(selector, value) {
  document.querySelector(selector).textContent = value || "";
}

function kebabCase(value) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function renderCafeInfo() {
  document.title = `${cafe.name} | المنيو`;
  document.querySelector('meta[name="description"]').content = `المنيو الإلكتروني لـ ${cafe.name}.`;
  document.querySelector('meta[name="theme-color"]').content = cafe.colors.cream;
  document.querySelector("#brand").setAttribute("aria-label", `${cafe.name}، الصفحة الرئيسية`);
  const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${cafe.colors.brown}"/><path d="M16 23h27v18a10 10 0 0 1-10 10h-7a10 10 0 0 1-10-10V23Zm27 5h4a6 6 0 0 1 0 12h-4M23 13v5m10-5v5m10-5v5" fill="none" stroke="${cafe.colors.cream}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  document.querySelector("#site-icon").href = `data:image/svg+xml,${encodeURIComponent(favicon)}`;

  Object.entries(cafe.colors).forEach(([name, value]) => {
    document.documentElement.style.setProperty(`--${kebabCase(name)}`, value);
  });

  const logo = document.querySelector("#brand-logo");
  if (cafe.logo) {
    logo.addEventListener("error", () => {
      logo.hidden = true;
      document.querySelector("#default-logo").hidden = false;
    }, { once: true });
    logo.src = cafe.logo;
    logo.hidden = false;
    document.querySelector("#default-logo").hidden = true;
  }

  setText("#brand-name", cafe.brandName);
  setText("#brand-descriptor", cafe.brandDescriptor);
  setText("#header-note", cafe.header.note);
  setText("#header-eyebrow", cafe.header.eyebrow);
  setText("#header-title", cafe.header.title);
  setText("#header-description", cafe.header.description);
  setText("#menu-eyebrow", cafe.header.menuEyebrow);
  setText("#menu-heading", cafe.header.menuTitle);
  setText("#footer-slogan", cafe.header.footer);

  const { contact } = cafe;
  const address = document.querySelector("#cafe-address");
  const hours = document.querySelector("#cafe-hours");
  address.hidden = !contact.address;
  address.textContent = contact.address ? `العنوان: ${contact.address}` : "";
  hours.hidden = !contact.hours;
  hours.textContent = contact.hours ? `أوقات العمل: ${contact.hours}` : "";

  const links = document.querySelector("#contact-links");
  links.replaceChildren();
  const addLink = (label, href, external = true, showEmpty = false) => {
    if (!href) {
      if (showEmpty) {
        const placeholder = document.createElement("span");
        placeholder.className = "contact-placeholder";
        placeholder.textContent = label;
        links.append(placeholder);
      }
      return;
    }
    const link = document.createElement("a");
    link.textContent = label;
    link.href = href;
    if (external) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
    links.append(link);
  };

  const phone = contact.phone.replace(/[^\d+]/g, "");
  const whatsappValue = typeof contact.whatsapp === "string" ? contact.whatsapp.trim() : "";
  const whatsapp = /^https?:\/\//i.test(whatsappValue)
    ? whatsappValue
    : whatsappValue.replace(/\D/g, "");
  const whatsappHref = /^https?:\/\//i.test(whatsapp)
    ? whatsapp
    : whatsapp ? `https://wa.me/${whatsapp}` : "";
  addLink("اتصال", phone ? `tel:${phone}` : "", false);
  addLink("واتساب", whatsappHref, true, true);
  addLink("إنستغرام", contact.instagram, true, true);
  addLink("تيك توك", contact.tiktok, true, true);
  addLink("سناب شات", contact.snapchat, true, true);
  addLink("الموقع", contact.mapsUrl);
  links.hidden = links.childElementCount === 0;
  document.querySelector("#footer-info").hidden =
    !contact.address && !contact.hours && links.hidden;
}

function formatPrice(amount) {
  return `${amount.toLocaleString("ar-SA-u-nu-latn")} ريال`;
}

function normalizeCategory(value) {
  const category = value.trim().toLowerCase();
  const compactCategory = category.replace(/\s+/g, "");
  if (["الحلويات", "حلويات", "حلى", "desserts"].includes(compactCategory)) {
    return "desserts";
  }
  return category;
}

function parseCsvRows(csvText) {
  const rows = [];
  let row = [];
  let field = "";
  let insideQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];

    if (character === '"') {
      if (insideQuotes && csvText[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (character === "," && !insideQuotes) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !insideQuotes) {
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
      if (character === "\r" && csvText[index + 1] === "\n") index += 1;
    } else {
      field += character;
    }
  }

  if (insideQuotes) throw new Error("ملف CSV يحتوي على اقتباس غير مكتمل.");
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function parseProductsCsv(csvText) {
  const rows = parseCsvRows(csvText.replace(/^\uFEFF/, ""));
  if (rows.length === 0) return [];

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const requiredColumns = ["id", "name", "price", "category", "available"];
  const missingColumns = requiredColumns.filter((column) => !headers.includes(column));
  if (missingColumns.length) {
    throw new Error(`أعمدة CSV المطلوبة غير موجودة: ${missingColumns.join(", ")}`);
  }

  const columnIndex = (name) => headers.indexOf(name);
  const firstColumnIndex = (...names) => names.map(columnIndex).find((index) => index !== -1) ?? -1;
  const valueAt = (row, name) => {
    const index = columnIndex(name);
    return index === -1 ? "" : (row[index] || "").trim();
  };
  const valueAtIndex = (row, index) => index === -1 ? "" : (row[index] || "").trim();
  const offerFlagIndex = firstColumnIndex("is_offer", "عرض_اليوم");
  const offerPriceIndex = firstColumnIndex("offer_price", "سعر_العرض");
  const descriptionIndex = firstColumnIndex("description", "notes", "note", "وصف", "ملاحظات");

  return rows.slice(1)
    .filter((row) => valueAt(row, "available").toLowerCase() === "yes")
    .map((row) => {
      const offerPriceValue = valueAtIndex(row, offerPriceIndex);
      return {
        id: valueAt(row, "id"),
        name: valueAt(row, "name"),
        price: Number(valueAt(row, "price")),
        category: normalizeCategory(valueAt(row, "category")),
        image: valueAt(row, "image"),
        available: valueAt(row, "available"),
        description: valueAtIndex(row, descriptionIndex),
        isOffer: ["yes", "نعم", "true", "1"].includes(valueAtIndex(row, offerFlagIndex).toLowerCase()),
        offerPrice: offerPriceValue ? Number(offerPriceValue) : NaN
      };
    });
}

function renderDailyOffer() {
  const offer = products.find((product) => product.isOffer && Number.isFinite(product.offerPrice));
  offerButton.hidden = !offer;
  if (!offer) return;

  document.querySelector("#offer-name").textContent = offer.name;
  document.querySelector("#offer-price").textContent = formatPrice(offer.offerPrice);
  const originalPrice = document.querySelector("#offer-original");
  originalPrice.hidden = !Number.isFinite(offer.price);
  originalPrice.textContent = Number.isFinite(offer.price) ? formatPrice(offer.price) : "";

  const imagePath = typeof offer.image === "string" ? offer.image.trim() : "";
  const offerImageFrame = document.querySelector("#offer-image-frame");
  offerImageFrame.hidden = !imagePath;
  offerImage.hidden = !imagePath;
  offerImage.alt = imagePath ? offer.name : "";
  offerImage.src = imagePath;
  offerImage.onerror = () => {
    offerImageFrame.hidden = true;
    offerImage.hidden = true;
  };
}

function showProductPreview(product) {
  const productCategory = product.category === "hot"
    ? "مشروب ساخن"
    : product.category === "cold" ? "مشروب بارد"
      : product.category === "desserts" ? "حلويات" : product.category;
  const category = document.querySelector("#preview-category");
  category.textContent = productCategory;
  category.hidden = !productCategory;

  document.querySelector("#preview-name").textContent = product.name;
  const description = document.querySelector("#preview-description");
  description.textContent = product.description;
  description.hidden = !product.description;

  const hasOfferPrice = product.isOffer && Number.isFinite(product.offerPrice);
  document.querySelector("#preview-price").textContent =
    formatPrice(hasOfferPrice ? product.offerPrice : product.price);
  const originalPrice = document.querySelector("#preview-original");
  originalPrice.hidden = !hasOfferPrice || !Number.isFinite(product.price);
  originalPrice.textContent = originalPrice.hidden ? "" : formatPrice(product.price);

  const imagePath = typeof product.image === "string" ? product.image.trim() : "";
  const previewImageFrame = document.querySelector("#preview-image-frame");
  previewImageFrame.hidden = !imagePath;
  previewImage.hidden = !imagePath;
  previewImage.alt = imagePath ? product.name : "";
  previewImage.onerror = () => {
    previewImageFrame.hidden = true;
    previewImage.hidden = true;
  };
  if (imagePath) {
    previewImage.src = imagePath;
  } else {
    previewImage.removeAttribute("src");
  }
  productPreview.showModal();
}

function renderProducts() {
  const visibleProducts = products.filter((product) => product.category === activeCategory);
  const fragment = document.createDocumentFragment();

  visibleProducts.forEach((product, index) => {
    const card = document.createElement("article");
    card.className = "product-card";
    card.style.setProperty("--card-order", index);
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-haspopup", "dialog");
    card.setAttribute("aria-label", `${product.name}، ${formatPrice(product.price)}، معاينة التفاصيل`);
    card.addEventListener("click", (event) => {
      if (event.target.closest("button, a, input, select, textarea")) return;
      showProductPreview(product);
    });
    card.addEventListener("keydown", (event) => {
      if ((event.key === "Enter" || event.key === " ") && event.target === card) {
        event.preventDefault();
        showProductPreview(product);
      }
    });

    const motif = document.createElement("span");
    motif.className = "product-motif";
    motif.setAttribute("aria-hidden", "true");
    motif.textContent = activeCategory === "hot" ? "〰" : "✳";

    const content = document.createElement("div");
    content.className = "product-content";

    const details = document.createElement("div");
    details.className = "product-details";

    const name = document.createElement("h3");
    name.className = "product-name";
    name.textContent = product.name;

    const price = document.createElement("p");
    price.className = "product-price";
    price.textContent = formatPrice(product.price);

    const imagePath = typeof product.image === "string" ? product.image.trim() : "";
    if (imagePath) {
      const imageFrame = document.createElement("div");
      imageFrame.className = "product-image-frame";
      const image = document.createElement("img");
      image.className = "product-image";
      image.src = imagePath;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.addEventListener("error", () => imageFrame.remove(), { once: true });
      imageFrame.append(image);
      content.append(imageFrame);
    }

    details.append(name, price);
    content.append(details);
    card.append(motif, content);
    fragment.append(card);
  });

  if (activeCategory === "desserts" && visibleProducts.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.setAttribute("role", "status");
    emptyState.textContent = "لا تتوفر أصناف حلويات حالياً، نأمل زيارتكم قريباً.";
    fragment.append(emptyState);
  }

  productList.replaceChildren(fragment);
  productList.setAttribute("aria-labelledby", `${activeCategory}-tab`);
  menuCount.textContent = `${visibleProducts.length} ${activeCategory === "desserts" ? "صنف" : "مشروب"}`;
}

async function loadProducts() {
  menuCount.textContent = "جارٍ تحميل المنتجات...";
  try {
    const response = await fetch(productsCsvUrl);
    if (!response.ok) {
      throw new Error(`طلب CSV فشل: ${response.status} ${response.statusText}`);
    }
    products = parseProductsCsv(await response.text());
    renderProducts();
    renderDailyOffer();
  } catch (error) {
    console.error("تعذر تحميل منتجات القائمة من Google Sheets.", error);
    productList.replaceChildren();
    menuCount.textContent = "تعذر تحميل المنتجات";
    offerButton.hidden = true;
  }
}

offerButton.addEventListener("click", () => offerModal.showModal());
document.querySelector("#offer-close").addEventListener("click", () => offerModal.close());
offerModal.addEventListener("click", (event) => {
  if (event.target === offerModal) offerModal.close();
});
offerModal.addEventListener("keydown", (event) => {
  if (event.key === "Escape") offerModal.close();
});
document.querySelector("#preview-close").addEventListener("click", () => productPreview.close());
productPreview.addEventListener("click", (event) => {
  if (event.target === productPreview) productPreview.close();
});
productPreview.addEventListener("keydown", (event) => {
  if (event.key === "Escape") productPreview.close();
});

function selectCategory(category) {
  activeCategory = category;
  categoryTabs.forEach((tab) => {
    const selected = tab.dataset.category === category;
    tab.classList.toggle("is-active", selected);
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  renderProducts();
}

categoryTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectCategory(tab.dataset.category));
  tab.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const nextTab = categoryTabs[(index + 1) % categoryTabs.length];
    selectCategory(nextTab.dataset.category);
    nextTab.focus();
  });
});

renderCafeInfo();
loadProducts();
