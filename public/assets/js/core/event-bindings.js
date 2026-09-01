export default [
  {
    "id": "b001",
    "event": "click",
    "source": "selRole('pharmacy')"
  },
  {
    "id": "b002",
    "event": "click",
    "source": "selRole('department')"
  },
  {
    "id": "b003",
    "event": "keydown",
    "source": "if(event.key==='Enter')doLogin()"
  },
  {
    "id": "b004",
    "event": "keydown",
    "source": "if(event.key==='Enter')doLogin()"
  },
  {
    "id": "b005",
    "event": "click",
    "source": "doLogin()"
  },
  {
    "id": "b006",
    "event": "click",
    "source": "toggleTheme()"
  },
  {
    "id": "b007",
    "event": "click",
    "source": "openLogoSettings()"
  },
  {
    "id": "b008",
    "event": "click",
    "source": "masterSaveLocalBackupToDevice()"
  },
  {
    "id": "b009",
    "event": "click",
    "source": "doLogout()"
  },
  {
    "id": "b010",
    "event": "change",
    "source": "renderInv()"
  },
  {
    "id": "b011",
    "event": "click",
    "source": "openAddDrug()"
  },
  {
    "id": "b012",
    "event": "click",
    "source": "openManageCats()"
  },
  {
    "id": "b013",
    "event": "click",
    "source": "showDupPanel()"
  },
  {
    "id": "b014",
    "event": "click",
    "source": "bulkChangeCategory()"
  },
  {
    "id": "b015",
    "event": "click",
    "source": "bulkSetMedicationFlag('refrigerated')"
  },
  {
    "id": "b016",
    "event": "click",
    "source": "bulkSetMedicationFlag('lasa')"
  },
  {
    "id": "b017",
    "event": "click",
    "source": "bulkSetMedicationFlag('hazard')"
  },
  {
    "id": "b018",
    "event": "click",
    "source": "bulkSetMedicationFlag('high_alert')"
  },
  {
    "id": "b019",
    "event": "click",
    "source": "bulkDelete()"
  },
  {
    "id": "b020",
    "event": "click",
    "source": "clearInvSelection()"
  },
  {
    "id": "b021",
    "event": "input",
    "source": "renderInvDebounced()"
  },
  {
    "id": "b022",
    "event": "change",
    "source": "renderInv()"
  },
  {
    "id": "b023",
    "event": "change",
    "source": "renderInv()"
  },
  {
    "id": "b024",
    "event": "change",
    "source": "toggleAllInv(this)"
  },
  {
    "id": "b025",
    "event": "click",
    "source": "cleanupOldOrders(false)"
  },
  {
    "id": "b026",
    "event": "click",
    "source": "filterR('all',this)"
  },
  {
    "id": "b027",
    "event": "click",
    "source": "filterR('pending',this)"
  },
  {
    "id": "b028",
    "event": "click",
    "source": "filterR('fulfilled',this)"
  },
  {
    "id": "b029",
    "event": "click",
    "source": "openAddUser()"
  },
  {
    "id": "b030",
    "event": "keydown",
    "source": "if(event.key==='Enter')addDept()"
  },
  {
    "id": "b031",
    "event": "click",
    "source": "addDept()"
  },
  {
    "id": "b032",
    "event": "change",
    "source": "renderAn()"
  },
  {
    "id": "b033",
    "event": "click",
    "source": "renderAn()"
  },
  {
    "id": "b034",
    "event": "change",
    "source": "renderAn()"
  },
  {
    "id": "b035",
    "event": "click",
    "source": "cleanupOldOrders(false)"
  },
  {
    "id": "b036",
    "event": "click",
    "source": "doPrint()"
  },
  {
    "id": "b037",
    "event": "click",
    "source": "document.querySelectorAll('.pchk').forEach(function(c){c.checked=true;})"
  },
  {
    "id": "b038",
    "event": "change",
    "source": "document.querySelectorAll('.pchk').forEach(function(c){c.checked=this.checked;}.bind(this))"
  },
  {
    "id": "b039",
    "event": "click",
    "source": "document.getElementById('xlsx-file-inp').click()"
  },
  {
    "id": "b040",
    "event": "change",
    "source": "handleXlsxFile(this.files[0])"
  },
  {
    "id": "b041",
    "event": "click",
    "source": "parseImport()"
  },
  {
    "id": "b042",
    "event": "click",
    "source": "clearImport()"
  },
  {
    "id": "b043",
    "event": "click",
    "source": "impSelectAll(true)"
  },
  {
    "id": "b044",
    "event": "click",
    "source": "impSelectAll(false)"
  },
  {
    "id": "b045",
    "event": "click",
    "source": "confirmImport()"
  },
  {
    "id": "b046",
    "event": "input",
    "source": "renderReqFormDebounced()"
  },
  {
    "id": "b047",
    "event": "click",
    "source": "submitReq()"
  },
  {
    "id": "b048",
    "event": "click",
    "source": "ctlOpenDepartmentPrintOptions()"
  },
  {
    "id": "b049",
    "event": "change",
    "source": "ctlParseReceiptPdf(this.files[0])"
  },
  {
    "id": "b050",
    "event": "change",
    "source": "ctlPdfToggleAll(this.checked)"
  },
  {
    "id": "b051",
    "event": "click",
    "source": "ctlPdfClearReview()"
  },
  {
    "id": "b052",
    "event": "click",
    "source": "ctlApprovePdfReceipt(false)"
  },
  {
    "id": "b053",
    "event": "click",
    "source": "ctlApprovePdfReceipt(true)"
  },
  {
    "id": "b054",
    "event": "change",
    "source": "renderControlled()"
  },
  {
    "id": "b055",
    "event": "click",
    "source": "ctlAssignMedicineToDept()"
  },
  {
    "id": "b056",
    "event": "click",
    "source": "ctlEditSignatures()"
  },
  {
    "id": "b057",
    "event": "click",
    "source": "ctlOpenBulkShelf()"
  },
  {
    "id": "b058",
    "event": "change",
    "source": "ctlToggleAllDeptMeds(this)"
  },
  {
    "id": "b059",
    "event": "click",
    "source": "controlledStorageOpenCreate()"
  },
  {
    "id": "b060",
    "event": "change",
    "source": "controlledStorageModeChanged()"
  },
  {
    "id": "b061",
    "event": "change",
    "source": "renderControlledStorage()"
  },
  {
    "id": "b062",
    "event": "click",
    "source": "controlledStorageCloseUnitModal()"
  },
  {
    "id": "b063",
    "event": "input",
    "source": "controlledStorageShelfCountChanged()"
  },
  {
    "id": "b064",
    "event": "click",
    "source": "controlledStorageCancelEdit()"
  },
  {
    "id": "b065",
    "event": "click",
    "source": "controlledStorageCloseUnitModal()"
  },
  {
    "id": "b066",
    "event": "click",
    "source": "controlledStorageSaveUnit()"
  },
  {
    "id": "b067",
    "event": "click",
    "source": "renderCtlAnalytics()"
  },
  {
    "id": "b068",
    "event": "click",
    "source": "printCtlAnalytics()"
  },
  {
    "id": "b069",
    "event": "click",
    "source": "doDeptPrint()"
  },
  {
    "id": "b070",
    "event": "click",
    "source": "saveAlertSettings()"
  },
  {
    "id": "b071",
    "event": "click",
    "source": "openAddShelf()"
  },
  {
    "id": "b072",
    "event": "input",
    "source": "renderShelfMedicationDatabase()"
  },
  {
    "id": "b073",
    "event": "change",
    "source": "renderShelfMedicationDatabase()"
  },
  {
    "id": "b074",
    "event": "click",
    "source": "assignSelectedMedsToShelf()"
  },
  {
    "id": "b075",
    "event": "click",
    "source": "clearShelfMedicationSelection()"
  },
  {
    "id": "b076",
    "event": "change",
    "source": "toggleAllShelfMedications(this.checked)"
  },
  {
    "id": "b077",
    "event": "click",
    "source": "printShelfList()"
  },
  {
    "id": "b078",
    "event": "click",
    "source": "submitNote()"
  },
  {
    "id": "b079",
    "event": "change",
    "source": "renderPharmNotes()"
  },
  {
    "id": "b080",
    "event": "change",
    "source": "renderPharmNotes()"
  },
  {
    "id": "b081",
    "event": "change",
    "source": "renderPharmNotes()"
  },
  {
    "id": "b082",
    "event": "click",
    "source": "saveRequestHourGrid()"
  },
  {
    "id": "b083",
    "event": "change",
    "source": "loadRequestHourGrid(this.value)"
  },
  {
    "id": "b084",
    "event": "click",
    "source": "selectAllRequestGridTargets(true)"
  },
  {
    "id": "b085",
    "event": "click",
    "source": "selectAllRequestGridTargets(false)"
  },
  {
    "id": "b086",
    "event": "click",
    "source": "saveRequestHourGrid()"
  },
  {
    "id": "b087",
    "event": "click",
    "source": "addDispSlot()"
  },
  {
    "id": "b088",
    "event": "click",
    "source": "openBulkLimits()"
  },
  {
    "id": "b089",
    "event": "click",
    "source": "saveAllLimits()"
  },
  {
    "id": "b090",
    "event": "click",
    "source": "crashAddCart()"
  },
  {
    "id": "b091",
    "event": "change",
    "source": "r17CrashSourceChanged()"
  },
  {
    "id": "b092",
    "event": "change",
    "source": "r17CrashScanMatches()"
  },
  {
    "id": "b093",
    "event": "input",
    "source": "r17CrashRenderMatrix()"
  },
  {
    "id": "b094",
    "event": "click",
    "source": "r17CrashSelectAllMatches(true)"
  },
  {
    "id": "b095",
    "event": "click",
    "source": "r17CrashSelectAllMatches(false)"
  },
  {
    "id": "b096",
    "event": "click",
    "source": "r17CrashAddReplacement()"
  },
  {
    "id": "b097",
    "event": "click",
    "source": "r17CrashExecuteBulk()"
  },
  {
    "id": "b098",
    "event": "click",
    "source": "CM('r18-crash-correction-modal')"
  },
  {
    "id": "b099",
    "event": "click",
    "source": "r18CrashCorrectionAddItem()"
  },
  {
    "id": "b100",
    "event": "click",
    "source": "CM('r18-crash-correction-modal')"
  },
  {
    "id": "b101",
    "event": "click",
    "source": "r18SaveCrashCorrection()"
  },
  {
    "id": "b102",
    "event": "click",
    "source": "masterExportDatabase()"
  },
  {
    "id": "b103",
    "event": "change",
    "source": "masterPreviewBackupFile(this.files[0])"
  },
  {
    "id": "b104",
    "event": "click",
    "source": "masterRestoreDatabase()"
  },
  {
    "id": "b105",
    "event": "click",
    "source": "masterCreateLocalBackup(true)"
  },
  {
    "id": "b106",
    "event": "click",
    "source": "masterSaveLocalBackupToDevice()"
  },
  {
    "id": "b107",
    "event": "click",
    "source": "masterDownloadLatestLocalBackup()"
  },
  {
    "id": "b108",
    "event": "click",
    "source": "masterRefreshSystemHealth()"
  },
  {
    "id": "b109",
    "event": "click",
    "source": "CM('mctl-bulk-shelf')"
  },
  {
    "id": "b110",
    "event": "click",
    "source": "CM('mctl-bulk-shelf')"
  },
  {
    "id": "b111",
    "event": "click",
    "source": "ctlApplyBulkShelf()"
  },
  {
    "id": "b112",
    "event": "click",
    "source": "CM('mshelf')"
  },
  {
    "id": "b113",
    "event": "click",
    "source": "CM('mshelf')"
  },
  {
    "id": "b114",
    "event": "click",
    "source": "saveShelf()"
  },
  {
    "id": "b115",
    "event": "click",
    "source": "CM('mdrug')"
  },
  {
    "id": "b116",
    "event": "click",
    "source": "CM('mdrug')"
  },
  {
    "id": "b117",
    "event": "click",
    "source": "saveDrug()"
  },
  {
    "id": "b118",
    "event": "click",
    "source": "CM('muser')"
  },
  {
    "id": "b119",
    "event": "change",
    "source": "updateUserRoleFields()"
  },
  {
    "id": "b120",
    "event": "click",
    "source": "CM('muser')"
  },
  {
    "id": "b121",
    "event": "click",
    "source": "saveUser()"
  },
  {
    "id": "b122",
    "event": "click",
    "source": "CM('mfulfill')"
  },
  {
    "id": "b123",
    "event": "click",
    "source": "CM('mfulfill')"
  },
  {
    "id": "b124",
    "event": "click",
    "source": "submitFulfill()"
  },
  {
    "id": "b125",
    "event": "click",
    "source": "CM('mview')"
  },
  {
    "id": "b126",
    "event": "click",
    "source": "stopScanner();CM('mexpiry')"
  },
  {
    "id": "b127",
    "event": "click",
    "source": "switchExpTab('manual')"
  },
  {
    "id": "b128",
    "event": "click",
    "source": "switchExpTab('scan')"
  },
  {
    "id": "b129",
    "event": "click",
    "source": "switchExpTab('type')"
  },
  {
    "id": "b130",
    "event": "change",
    "source": "switchCamera(this.value)"
  },
  {
    "id": "b131",
    "event": "click",
    "source": "restartScanner()"
  },
  {
    "id": "b132",
    "event": "click",
    "source": "applyScanResult()"
  },
  {
    "id": "b133",
    "event": "click",
    "source": "parseTypedBarcode()"
  },
  {
    "id": "b134",
    "event": "click",
    "source": "applyTypedResult()"
  },
  {
    "id": "b135",
    "event": "click",
    "source": "stopScanner();CM('mexpiry')"
  },
  {
    "id": "b136",
    "event": "click",
    "source": "saveExpiry()"
  },
  {
    "id": "b137",
    "event": "click",
    "source": "CM('mdup')"
  },
  {
    "id": "b138",
    "event": "change",
    "source": "toggleDupAll(this)"
  },
  {
    "id": "b139",
    "event": "click",
    "source": "CM('mdup')"
  },
  {
    "id": "b140",
    "event": "click",
    "source": "deleteSelected()"
  },
  {
    "id": "b141",
    "event": "click",
    "source": "CM('mnote-reply')"
  },
  {
    "id": "b142",
    "event": "click",
    "source": "CM('mnote-reply')"
  },
  {
    "id": "b143",
    "event": "click",
    "source": "saveNoteReply()"
  },
  {
    "id": "b144",
    "event": "click",
    "source": "CM('mcat-mgr')"
  },
  {
    "id": "b145",
    "event": "keydown",
    "source": "if(event.key==='Enter')addCategory()"
  },
  {
    "id": "b146",
    "event": "click",
    "source": "addCategory()"
  },
  {
    "id": "b147",
    "event": "click",
    "source": "CM('mcat-mgr')"
  },
  {
    "id": "b148",
    "event": "click",
    "source": "CM('mlogo')"
  },
  {
    "id": "b149",
    "event": "click",
    "source": "el('logo-file-inp').click()"
  },
  {
    "id": "b150",
    "event": "change",
    "source": "handleLogoFile(this.files[0])"
  },
  {
    "id": "b151",
    "event": "click",
    "source": "clearLogo()"
  },
  {
    "id": "b152",
    "event": "click",
    "source": "CM('mlogo')"
  },
  {
    "id": "b153",
    "event": "click",
    "source": "saveLogo()"
  },
  {
    "id": "b154",
    "event": "click",
    "source": "CM('mreq-window')"
  },
  {
    "id": "b155",
    "event": "click",
    "source": "CM('mreq-window')"
  },
  {
    "id": "b156",
    "event": "click",
    "source": "saveReqWindow()"
  },
  {
    "id": "b157",
    "event": "click",
    "source": "CM('mdisp-slot')"
  },
  {
    "id": "b158",
    "event": "click",
    "source": "CM('mdisp-slot')"
  },
  {
    "id": "b159",
    "event": "click",
    "source": "saveDispSlot()"
  },
  {
    "id": "b160",
    "event": "click",
    "source": "CM('mbulk-limits')"
  },
  {
    "id": "b161",
    "event": "click",
    "source": "applyBulkLimit()"
  },
  {
    "id": "b162",
    "event": "click",
    "source": "CM('mbulk-limits')"
  },
  {
    "id": "b163",
    "event": "click",
    "source": "saveBulkLimits()"
  },
  {
    "id": "b164",
    "event": "click",
    "source": "zebraRefreshPrinters()"
  },
  {
    "id": "b165",
    "event": "click",
    "source": "zebraImportDatabase()"
  },
  {
    "id": "b166",
    "event": "click",
    "source": "zebraImportDatabase()"
  },
  {
    "id": "b167",
    "event": "input",
    "source": "zebraFilterMedicines()"
  },
  {
    "id": "b168",
    "event": "change",
    "source": "zebraSelectMedicine()"
  },
  {
    "id": "b169",
    "event": "input",
    "source": "zebraUpdatePreview()"
  },
  {
    "id": "b170",
    "event": "input",
    "source": "zebraUpdatePreview()"
  },
  {
    "id": "b171",
    "event": "change",
    "source": "zebraTemplateChanged()"
  },
  {
    "id": "b172",
    "event": "change",
    "source": "zebraUpdatePreview()"
  },
  {
    "id": "b173",
    "event": "input",
    "source": "zebraUpdatePreview()"
  },
  {
    "id": "b174",
    "event": "click",
    "source": "zebraPrintLabels()"
  },
  {
    "id": "b175",
    "event": "click",
    "source": "zebraTestLabel()"
  },
  {
    "id": "b176",
    "event": "click",
    "source": "zebraDownloadZPL()"
  },
  {
    "id": "b177",
    "event": "click",
    "source": "CM('v13-receive-modal')"
  },
  {
    "id": "b178",
    "event": "click",
    "source": "CM('v13-receive-modal')"
  },
  {
    "id": "b179",
    "event": "click",
    "source": "v13SaveReceive()"
  },
  {
    "id": "b180",
    "event": "click",
    "source": "CM('mwh-stock-pro')"
  },
  {
    "id": "b181",
    "event": "click",
    "source": "whAddBatchRow()"
  },
  {
    "id": "b182",
    "event": "click",
    "source": "CM('mwh-stock-pro')"
  },
  {
    "id": "b183",
    "event": "click",
    "source": "whSaveStockPro()"
  },
  {
    "id": "b184",
    "event": "click",
    "source": "CM('mcrash-cart-pro')"
  },
  {
    "id": "b185",
    "event": "click",
    "source": "CM('mcrash-cart-pro')"
  },
  {
    "id": "b186",
    "event": "click",
    "source": "crashSaveCartPro()"
  },
  {
    "id": "b187",
    "event": "click",
    "source": "CM('mwh-receive')"
  },
  {
    "id": "b188",
    "event": "input",
    "source": "whReceiveRenderSearch()"
  },
  {
    "id": "b189",
    "event": "click",
    "source": "CM('mwh-receive')"
  },
  {
    "id": "b190",
    "event": "click",
    "source": "whReceiveSave()"
  },
  {
    "id": "b191",
    "event": "click",
    "source": "CM('mcc-report')"
  },
  {
    "id": "b192",
    "event": "click",
    "source": "CM('mcc-report')"
  },
  {
    "id": "b193",
    "event": "click",
    "source": "ccSubmitReport()"
  },
  {
    "id": "b194",
    "event": "click",
    "source": "CM('mcc-close')"
  },
  {
    "id": "b195",
    "event": "click",
    "source": "CM('mcc-close')"
  },
  {
    "id": "b196",
    "event": "click",
    "source": "ccSavePharmacyResponse()"
  },
  {
    "id": "b197",
    "event": "click",
    "source": "runSystemHealthDiagnostics()"
  },
  {
    "id": "b198",
    "event": "click",
    "source": "CM('mwh-bulk-receive')"
  },
  {
    "id": "b199",
    "event": "click",
    "source": "whBulkAddReceiveRow()"
  },
  {
    "id": "b200",
    "event": "click",
    "source": "CM('mwh-bulk-receive')"
  },
  {
    "id": "b201",
    "event": "click",
    "source": "whBulkReceiveSave()"
  },
  {
    "id": "b202",
    "event": "click",
    "source": "CM('mwh-bulk-dispense')"
  },
  {
    "id": "b203",
    "event": "click",
    "source": "whBulkAddDispenseRow()"
  },
  {
    "id": "b204",
    "event": "click",
    "source": "CM('mwh-bulk-dispense')"
  },
  {
    "id": "b205",
    "event": "click",
    "source": "whBulkDispenseSave()"
  },
  {
    "id": "b206",
    "event": "dragleave",
    "source": "this.style.borderColor='var(--bd)'"
  },
  {
    "id": "b206",
    "event": "dragover",
    "source": "event.preventDefault();this.style.borderColor='var(--ac)'"
  },
  {
    "id": "b206",
    "event": "drop",
    "source": "handleXlsxDrop(event)"
  },
  {
    "id": "b209",
    "event": "dragleave",
    "source": "ctlPdfDrag(event,false)"
  },
  {
    "id": "b209",
    "event": "dragover",
    "source": "ctlPdfDrag(event,true)"
  },
  {
    "id": "b209",
    "event": "drop",
    "source": "ctlPdfDrop(event)"
  },
  {
    "id": "b212",
    "event": "dragleave",
    "source": "this.style.borderColor='var(--bd)'"
  },
  {
    "id": "b212",
    "event": "dragover",
    "source": "event.preventDefault();this.style.borderColor='var(--ac)'"
  },
  {
    "id": "b212",
    "event": "drop",
    "source": "handleLogoDrop(event)"
  },
  {
    "id": "b213",
    "event": "click",
    "source": "ctlOpenCustodyLog()"
  },
  {
    "id": "b214",
    "event": "click",
    "source": "CM('mcustody-log')"
  },
  {
    "id": "b215",
    "event": "click",
    "source": "ctlCustodyLogApplyFilters()"
  },
  {
    "id": "b216",
    "event": "click",
    "source": "ctlCustodyLogClearFilters()"
  },
  {
    "id": "b217",
    "event": "click",
    "source": "hideSelectedZeroDispense()"
  },
  {
    "id": "b218",
    "event": "change",
    "source": "ccToggleNoConsumption(this.checked)"
  }
];
