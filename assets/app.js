(() => {
  "use strict";

  const SUPPORTED_EXTENSIONS = new Set(["csv", "json", "xlsx"]);
  const YIELD_INTERVAL = 250;

  const ACTIONS = [
    ["none", "Leave unchanged"],
    ["hash", "Hash with SHA-256"],
    ["redact", "Redact"],
    ["fake_name", "Synthetic full name"],
    ["fake_email", "Synthetic email address"],
    ["fake_phone", "Synthetic phone number"],
    ["fake_address", "Synthetic street address"],
    ["fake_date", "Synthetic past date"]
  ];

  const state = {
    file: null,
    data: [],
    headers: [],
    extension: "",
    sourceMeta: {},
    isBusy: false,
    dragDepth: 0,
    downloadUrl: null
  };

  const elements = {
    body: document.body,
    dropzone: document.getElementById("dropzone"),
    chooseFileButton: document.getElementById("choose-file-button"),
    clearFileButton: document.getElementById("clear-file-button"),
    fileInput: document.getElementById("file-input"),
    fileSummary: document.getElementById("file-summary"),
    fileName: document.getElementById("file-name"),
    fileMeta: document.getElementById("file-meta"),
    mappingSection: document.getElementById("mapping-section"),
    mappingHeading: document.getElementById("mapping-heading"),
    mappingRows: document.getElementById("mapping-rows"),
    mappingSelectionStatus: document.getElementById("mapping-selection-status"),
    bulkAction: document.getElementById("bulk-action"),
    processButton: document.getElementById("process-button"),
    resetMappingsButton: document.getElementById("reset-mappings-button"),
    progressWrap: document.getElementById("progress-wrap"),
    progress: document.getElementById("progress"),
    progressText: document.getElementById("progress-text"),
    status: document.getElementById("app-status-message")
  };

  function setStatus(message, type = "info") {
    elements.status.textContent = message;
    elements.status.className = `app-alert app-alert--${type}`;
  }

  function clearStatus() {
    setStatus("", "info");
  }

  function getExtension(filename) {
    const lastSegment = String(filename || "").split(/[\\/]/).pop() || "";
    const dotIndex = lastSegment.lastIndexOf(".");
    return dotIndex > -1 ? lastSegment.slice(dotIndex + 1).toLowerCase() : "";
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 bytes";
    const units = ["bytes", "KB", "MB", "GB", "TB"];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    const decimals = unitIndex === 0 || value >= 100 ? 0 : 1;
    return `${value.toFixed(decimals)} ${units[unitIndex]}`;
  }

  function pluralize(count, singular, plural = `${singular}s`) {
    return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
  }

  function isBlank(value) {
    return value === null || value === undefined || (typeof value === "string" && value.length === 0);
  }

  function canonicalValue(value) {
    if (value === null) return "null:null";
    if (typeof value === "object") {
      try {
        return `object:${JSON.stringify(value)}`;
      } catch {
        return `object:${String(value)}`;
      }
    }
    return `${typeof value}:${String(value)}`;
  }

  function yieldToBrowser() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }

  function revokeDownloadUrl() {
    if (!state.downloadUrl) return;
    URL.revokeObjectURL(state.downloadUrl);
    state.downloadUrl = null;
  }

  function triggerDownload(blob, filename) {
    revokeDownloadUrl();
    state.downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = state.downloadUrl;
    link.download = filename;
    link.style.display = "none";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(revokeDownloadUrl, 60000);
  }

  function safeOutputFilename(filename, extension) {
    const safeName = String(filename || `data.${extension}`)
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
      .replace(/^\.+/, "")
      .trim() || `data.${extension}`;
    const suffix = `.${extension}`;
    const base = safeName.toLowerCase().endsWith(suffix) ? safeName.slice(0, -suffix.length) : safeName;
    return `${base}-anonymized${suffix}`;
  }

  function updateProgress(completed, total, message) {
    const safeTotal = Math.max(total, 1);
    const safeCompleted = Math.min(Math.max(completed, 0), safeTotal);
    const percent = Math.round((safeCompleted / safeTotal) * 100);
    elements.progress.max = safeTotal;
    elements.progress.value = safeCompleted;
    elements.progressText.textContent = `${percent}% - ${message}`;
  }

  function setBusy(busy) {
    state.isBusy = busy;
    elements.chooseFileButton.disabled = busy;
    elements.clearFileButton.disabled = busy || !state.file;
    elements.fileInput.disabled = busy;
    elements.bulkAction.disabled = busy || !state.file;
    elements.resetMappingsButton.disabled = busy || !state.file;
    elements.mappingRows.querySelectorAll("select").forEach((select) => {
      select.disabled = busy;
    });
    updateActionState();
  }

  function getMappings() {
    const mappings = new Map();
    elements.mappingRows.querySelectorAll("select[data-column]").forEach((select) => {
      if (select.value !== "none") mappings.set(select.dataset.column, select.value);
    });
    return mappings;
  }

  function updateActionState() {
    const selectedCount = getMappings().size;
    const hasFile = Boolean(state.file && state.data.length && state.headers.length);
    elements.processButton.disabled = state.isBusy || !hasFile || selectedCount === 0;
    elements.clearFileButton.disabled = state.isBusy || !state.file;
    elements.resetMappingsButton.disabled = state.isBusy || !hasFile;
    elements.mappingSelectionStatus.textContent = selectedCount === 0
      ? "No fields selected for anonymization."
      : `${pluralize(selectedCount, "field")} will be changed.`;
  }

  function buildActionSelect(column, index) {
    const select = document.createElement("select");
    select.id = `mapping-action-${index}`;
    select.dataset.column = column;

    ACTIONS.forEach(([value, label], actionIndex) => {
      if (actionIndex === 3) {
        const group = document.createElement("optgroup");
        group.label = "Synthetic values";
        ACTIONS.slice(3).forEach(([groupValue, groupLabel]) => {
          const option = document.createElement("option");
          option.value = groupValue;
          option.textContent = groupLabel;
          group.append(option);
        });
        select.append(group);
        return;
      }
      if (actionIndex > 3) return;
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.append(option);
    });

    select.addEventListener("change", () => {
      elements.bulkAction.value = "";
      updateActionState();
    });
    return select;
  }

  function renderMappings() {
    elements.mappingRows.replaceChildren();
    const fragment = document.createDocumentFragment();

    state.headers.forEach((header, index) => {
      const row = document.createElement("tr");
      const nameCell = document.createElement("td");
      const actionCell = document.createElement("td");
      const label = document.createElement("label");
      const select = buildActionSelect(header, index);

      label.className = "anonymizer-field-name";
      label.htmlFor = select.id;
      label.textContent = header;
      nameCell.append(label);
      actionCell.append(select);
      row.append(nameCell, actionCell);
      fragment.append(row);
    });

    elements.mappingRows.append(fragment);
    elements.bulkAction.value = "";
    elements.mappingSection.hidden = false;
    updateActionState();
  }

  function collectHeaders(rows) {
    const headers = [];
    const seen = new Set();
    rows.forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (seen.has(key)) return;
        seen.add(key);
        headers.push(key);
      });
    });
    return headers;
  }

  function normalizeRows(value, sourceLabel) {
    if (!Array.isArray(value)) {
      throw new Error(`${sourceLabel} must contain an array of records.`);
    }
    const rows = value.filter((row) => row !== null && typeof row === "object" && !Array.isArray(row));
    if (rows.length !== value.length) {
      throw new Error(`${sourceLabel} must contain only object records.`);
    }
    if (!rows.length) throw new Error("The file does not contain any data rows.");
    const headers = collectHeaders(rows);
    if (!headers.length) throw new Error("The file does not contain any field names.");
    return { rows, headers };
  }

  function parseCsv(file) {
    return new Promise((resolve, reject) => {
      window.Papa.parse(file, {
        header: true,
        skipEmptyLines: "greedy",
        complete(results) {
          try {
            const fatalError = results.errors.find((error) => error.type !== "FieldMismatch");
            if (fatalError) throw new Error(fatalError.message || "The CSV file could not be parsed.");
            const normalized = normalizeRows(results.data, "The CSV file");
            resolve({
              data: normalized.rows,
              headers: normalized.headers,
              meta: {
                format: "CSV",
                warningCount: results.errors.length
              }
            });
          } catch (error) {
            reject(error);
          }
        },
        error(error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
    });
  }

  async function parseJson(file) {
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch (error) {
      throw new Error(`The JSON file is not valid: ${error.message}`);
    }
    const normalized = normalizeRows(parsed, "The JSON file");
    return {
      data: normalized.rows,
      headers: normalized.headers,
      meta: { format: "JSON" }
    };
  }

  async function parseXlsx(file) {
    const workbook = window.XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error("The workbook does not contain a worksheet.");
    const worksheet = workbook.Sheets[sheetName];
    const rows = window.XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false });
    const normalized = normalizeRows(rows, "The first worksheet");
    return {
      data: normalized.rows,
      headers: normalized.headers,
      meta: { format: "Excel workbook", sheetName }
    };
  }

  async function parseFile(file, extension) {
    if (extension === "csv") return parseCsv(file);
    if (extension === "json") return parseJson(file);
    if (extension === "xlsx") return parseXlsx(file);
    throw new Error("Choose a CSV, JSON, or XLSX file.");
  }

  function showStartTab() {
    if (window.location.hash !== "#start") window.location.hash = "start";
  }

  function renderFileSummary() {
    const details = [
      state.sourceMeta.format,
      formatBytes(state.file.size),
      pluralize(state.data.length, "row"),
      pluralize(state.headers.length, "field")
    ];
    if (state.sourceMeta.sheetName) details.push(`worksheet: ${state.sourceMeta.sheetName}`);
    elements.fileName.textContent = state.file.name;
    elements.fileMeta.textContent = details.join(" | ");
    elements.fileSummary.hidden = false;
  }

  async function loadFile(file) {
    if (!(file instanceof File) || state.isBusy) return;
    const extension = getExtension(file.name);
    showStartTab();

    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      setStatus("Choose a CSV, JSON, or XLSX file.", "danger");
      return;
    }
    if (file.size === 0) {
      setStatus("The selected file is empty.", "danger");
      return;
    }

    setBusy(true);
    elements.progressWrap.hidden = false;
    updateProgress(0, 1, `Reading ${file.name}`);
    setStatus(`Reading ${file.name}...`, "info");

    try {
      const parsed = await parseFile(file, extension);
      state.file = file;
      state.extension = extension;
      state.data = parsed.data;
      state.headers = parsed.headers;
      state.sourceMeta = parsed.meta;
      renderFileSummary();
      renderMappings();
      updateProgress(1, 1, "File ready");
      const warningText = parsed.meta.warningCount
        ? ` The CSV parser reported ${pluralize(parsed.meta.warningCount, "row-length warning")}; review the output carefully.`
        : "";
      setStatus(`${file.name} is ready. Choose how to anonymize each field.${warningText}`, parsed.meta.warningCount ? "warning" : "success");
      await yieldToBrowser();
      elements.mappingHeading.focus({ preventScroll: true });
      elements.mappingSection.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      resetFile({ keepStatus: true });
      setStatus(error?.message || "The file could not be read.", "danger");
    } finally {
      elements.progressWrap.hidden = true;
      setBusy(false);
    }
  }

  function resetMappings() {
    elements.mappingRows.querySelectorAll("select").forEach((select) => {
      select.value = "none";
    });
    elements.bulkAction.value = "";
    updateActionState();
    setStatus("Field choices reset.", "info");
  }

  function resetFile(options = {}) {
    revokeDownloadUrl();
    state.file = null;
    state.data = [];
    state.headers = [];
    state.extension = "";
    state.sourceMeta = {};
    elements.fileInput.value = "";
    elements.fileSummary.hidden = true;
    elements.fileName.textContent = "";
    elements.fileMeta.textContent = "";
    elements.mappingRows.replaceChildren();
    elements.mappingSection.hidden = true;
    elements.bulkAction.value = "";
    elements.progressWrap.hidden = true;
    if (!options.keepStatus) clearStatus();
    setBusy(false);
  }

  function syntheticValue(rule) {
    const fakerInstance = window.faker;
    switch (rule) {
      case "fake_name":
        return fakerInstance.person?.fullName?.() ?? fakerInstance.name?.findName?.() ?? "Sample Person";
      case "fake_email":
        return fakerInstance.internet?.email?.() ?? "sample@example.test";
      case "fake_phone":
        return fakerInstance.phone?.number?.() ?? fakerInstance.phone?.phoneNumber?.() ?? "555-0100";
      case "fake_address":
        return fakerInstance.location?.streetAddress?.() ?? fakerInstance.address?.streetAddress?.() ?? "100 Sample Street";
      case "fake_date": {
        const date = fakerInstance.date?.past?.() ?? new Date(Date.now() - 86400000);
        return date.toISOString().slice(0, 10);
      }
      default:
        throw new Error(`Unknown anonymization action: ${rule}`);
    }
  }

  function transformValue(value, rule, cache) {
    if (isBlank(value)) return value;
    if (rule === "hash") {
      const input = typeof value === "object" ? canonicalValue(value) : String(value);
      return window.CryptoJS.SHA256(input).toString(window.CryptoJS.enc.Hex);
    }
    if (rule === "redact") return "---REDACTED---";

    const key = canonicalValue(value);
    if (!cache.has(key)) cache.set(key, syntheticValue(rule));
    return cache.get(key);
  }

  async function transformData(mappings) {
    const replacementCaches = new Map();
    mappings.forEach((rule, column) => {
      if (rule.startsWith("fake_")) replacementCaches.set(`${column}\u0000${rule}`, new Map());
    });

    const output = [];
    const total = state.data.length;
    for (let index = 0; index < total; index += 1) {
      const sourceRow = state.data[index];
      const newRow = { ...sourceRow };
      mappings.forEach((rule, column) => {
        if (!Object.prototype.hasOwnProperty.call(newRow, column)) return;
        const cache = replacementCaches.get(`${column}\u0000${rule}`) ?? new Map();
        newRow[column] = transformValue(newRow[column], rule, cache);
      });
      output.push(newRow);

      if ((index + 1) % YIELD_INTERVAL === 0 || index + 1 === total) {
        updateProgress(index + 1, total, `Anonymizing ${pluralize(index + 1, "row")}`);
        await yieldToBrowser();
      }
    }
    return output;
  }

  function exportData(data, extension, filename) {
    let blob;
    if (extension === "json") {
      blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    } else if (extension === "csv") {
      const csv = window.Papa.unparse(data, { newline: "\r\n" });
      blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    } else if (extension === "xlsx") {
      const worksheet = window.XLSX.utils.json_to_sheet(data, { header: state.headers });
      const workbook = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(workbook, worksheet, "Anonymized Data");
      const output = window.XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      blob = new Blob([output], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    } else {
      throw new Error("The output format is not supported.");
    }
    triggerDownload(blob, filename);
    return blob.size;
  }

  async function processAndDownload() {
    if (state.isBusy || !state.file) return;
    const mappings = getMappings();
    if (!mappings.size) {
      setStatus("Select at least one field to anonymize.", "warning");
      return;
    }

    setBusy(true);
    elements.progressWrap.hidden = false;
    updateProgress(0, state.data.length, "Preparing data");
    setStatus("Anonymizing data...", "info");

    try {
      const output = await transformData(mappings);
      updateProgress(state.data.length, state.data.length, "Creating download");
      await yieldToBrowser();
      const filename = safeOutputFilename(state.file.name, state.extension);
      const outputSize = exportData(output, state.extension, filename);
      setStatus(`Download started: ${filename} (${formatBytes(outputSize)}).`, "success");
    } catch (error) {
      setStatus(`The file could not be anonymized: ${error?.message || error}`, "danger");
    } finally {
      elements.progressWrap.hidden = true;
      setBusy(false);
    }
  }

  function hasFilesInDrag(event) {
    return Array.from(event.dataTransfer?.types || []).includes("Files");
  }

  function setDragActive(active) {
    elements.body.classList.toggle("is-dragging", active);
    elements.dropzone.dataset.active = String(active);
  }

  function resetDragState() {
    state.dragDepth = 0;
    setDragActive(false);
  }

  elements.chooseFileButton.addEventListener("click", () => elements.fileInput.click());
  elements.clearFileButton.addEventListener("click", () => {
    resetFile();
    setStatus("File cleared.", "info");
  });

  elements.fileInput.addEventListener("change", () => {
    const [file] = Array.from(elements.fileInput.files || []);
    elements.fileInput.value = "";
    if (file) loadFile(file);
  });

  elements.bulkAction.addEventListener("change", () => {
    if (!elements.bulkAction.value) return;
    elements.mappingRows.querySelectorAll("select").forEach((select) => {
      select.value = elements.bulkAction.value;
    });
    updateActionState();
  });

  elements.resetMappingsButton.addEventListener("click", resetMappings);
  elements.processButton.addEventListener("click", processAndDownload);

  window.addEventListener("dragenter", (event) => {
    if (!hasFilesInDrag(event)) return;
    event.preventDefault();
    if (state.isBusy) {
      resetDragState();
      return;
    }
    state.dragDepth += 1;
    setDragActive(true);
  });

  window.addEventListener("dragover", (event) => {
    if (!hasFilesInDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = state.isBusy ? "none" : "copy";
    if (state.isBusy) {
      resetDragState();
      return;
    }
    setDragActive(true);
  });

  window.addEventListener("dragleave", (event) => {
    if (!hasFilesInDrag(event)) return;
    if (state.isBusy) {
      resetDragState();
      return;
    }
    state.dragDepth = Math.max(0, state.dragDepth - 1);
    if (state.dragDepth === 0) setDragActive(false);
  });

  window.addEventListener("drop", (event) => {
    if (!hasFilesInDrag(event)) return;
    event.preventDefault();
    resetDragState();
    if (state.isBusy) {
      setStatus("Wait for the current operation to finish before choosing another file.", "warning");
      return;
    }
    const files = Array.from(event.dataTransfer?.files || []);
    if (files.length !== 1) {
      setStatus("Drop one CSV, JSON, or XLSX file at a time.", "warning");
      return;
    }
    loadFile(files[0]);
  });

  window.addEventListener("blur", resetDragState);
  window.addEventListener("beforeunload", revokeDownloadUrl);

  const missingLibraries = [
    ["Papa Parse", window.Papa],
    ["SheetJS", window.XLSX],
    ["CryptoJS", window.CryptoJS],
    ["Faker", window.faker]
  ].filter(([, value]) => !value).map(([name]) => name);

  if (missingLibraries.length) {
    setStatus(`Required local libraries did not load: ${missingLibraries.join(", ")}.`, "danger");
    elements.chooseFileButton.disabled = true;
    elements.fileInput.disabled = true;
  } else {
    clearStatus();
  }

  updateActionState();
})();
