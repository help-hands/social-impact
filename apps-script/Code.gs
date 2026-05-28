var TABLES_TO_SNAPSHOT = ['profiles', 'roles', 'donations_in', 'donations_out', 'documents', 'donation_out_details', 'donation_out_media'];
var APP_ROOT_FOLDER_NAME = 'Social Impact';

function doGet() {
  var folders = ensureDriveFolders();

  return jsonResponse({
    ok: true,
    service: 'social-impact-apps-script',
    actions: ['setupDriveFolders', 'uploadDocument', 'uploadDonationOutMedia', 'getDocumentFile', 'getPublicDonationOutMedia', 'createSnapshot'],
    folders: folders
  });
}

function doPost(event) {
  try {
    var payload = parsePayload(event);

    if (payload.action === 'uploadDocument') {
      return jsonResponse(uploadDocument(payload));
    }

    if (payload.action === 'uploadDonationOutMedia') {
      return jsonResponse(uploadDonationOutMedia(payload));
    }

    if (payload.action === 'getDocumentFile') {
      return jsonResponse(getDocumentFile(payload));
    }

    if (payload.action === 'getPublicDonationOutMedia') {
      return jsonResponse(getPublicDonationOutMedia(payload));
    }

    if (payload.action === 'setupDriveFolders') {
      return jsonResponse({
        ok: true,
        folders: ensureDriveFolders()
      });
    }

    if (payload.action === 'createSnapshot') {
      return jsonResponse(createSnapshot(payload));
    }

    throw new Error('Unknown action: ' + payload.action);
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error.message || String(error)
    });
  }
}

function uploadDonationOutMedia(payload) {
  requireFields(payload, ['accessToken', 'donationId', 'fileName', 'mimeType', 'base64']);

  if (!isAllowedDonationOutMediaType(payload.mimeType)) {
    throw new Error('Only image and video files can be uploaded for donation-out detail pages.');
  }

  var user = verifySupabaseUser(payload.accessToken);
  if (!isAdmin(user.id)) {
    throw new Error('Only admins can upload donation-out page media.');
  }

  var donation = getDonationRecord('donation_out', payload.donationId);
  var folders = ensureDriveFolders();
  var dateFolder = getOrCreateDonationDateFolder(folders.donationOutFolderId, donation.donated_at);
  var mediaFolder = getOrCreateChildFolder(dateFolder, 'page-media');
  var bytes = decodeBase64(payload.base64);
  var blob = Utilities.newBlob(bytes, payload.mimeType, sanitizeFileName(payload.fileName));
  var file = mediaFolder.createFile(blob);

  if (getOptionalProperty('DOCUMENT_LINK_ACCESS') === 'public') {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }

  var documentRows = supabaseRest('documents', 'post', {
    drive_file_id: file.getId(),
    url: file.getUrl(),
    mime_type: payload.mimeType,
    file_name: file.getName(),
    folder_type: 'donation_out',
    uploaded_by: user.id
  }, '', { prefer: 'return=representation' });

  if (!documentRows.length) {
    throw new Error('Document row was not created.');
  }

  return {
    ok: true,
    document: documentRows[0]
  };
}

function getPublicDonationOutMedia(payload) {
  requireFields(payload, ['donationId']);

  if (!payload.mediaId && !payload.documentId) {
    throw new Error('mediaId is required.');
  }

  var donation = getDonationRecord('donation_out', payload.donationId);
  if (donation.status !== 'success' || donation.deleted_at) {
    throw new Error('This donation-out page is not available.');
  }

  var documentId = payload.documentId;

  if (payload.mediaId) {
    var mediaRows = supabaseRest(
      'donation_out_media',
      'get',
      null,
      '?select=document_id&donation_out_id=eq.' +
        encodeURIComponent(donation.id) +
        '&id=eq.' +
        encodeURIComponent(payload.mediaId) +
        '&limit=1',
      {}
    );

    if (!mediaRows.length) {
      throw new Error('Media was not found.');
    }

    documentId = mediaRows[0].document_id;
  }

  ensureDonationOutMediaCanBeViewed(documentId, donation.id, false);

  var documents = supabaseRest(
    'documents',
    'get',
    null,
    '?select=*&id=eq.' + encodeURIComponent(documentId) + '&limit=1',
    {}
  );

  if (!documents.length) {
    throw new Error('Document was not found.');
  }

  var document = documents[0];
  if (!isAllowedDonationOutMediaType(document.mime_type)) {
    throw new Error('This file cannot be viewed publicly.');
  }

  var file = DriveApp.getFileById(document.drive_file_id);
  var blob = file.getBlob();
  var bytes = blob.getBytes();
  var maxBytes = Number(getOptionalProperty('PUBLIC_MEDIA_PREVIEW_MAX_BYTES') ||
    getOptionalProperty('DOCUMENT_PREVIEW_MAX_BYTES') ||
    10485760);

  if (bytes.length > maxBytes) {
    throw new Error('Media is too large to preview.');
  }

  return {
    ok: true,
    document: {
      id: document.id,
      drive_file_id: '',
      url: '',
      file_name: document.file_name,
      mime_type: document.mime_type,
      base64: Utilities.base64Encode(bytes)
    }
  };
}

function uploadDocument(payload) {
  requireFields(payload, ['accessToken', 'donationType', 'fileName', 'mimeType', 'base64']);

  if (payload.donationType !== 'donation_in' && payload.donationType !== 'donation_out') {
    throw new Error('donationType must be donation_in or donation_out.');
  }

  var user = verifySupabaseUser(payload.accessToken);
  var admin = isAdmin(user.id);
  var donation = payload.donationId ? getDonationRecord(payload.donationType, payload.donationId) : null;

  if (payload.donationType === 'donation_in' && donation && donation.user_id !== user.id && !admin) {
    throw new Error('You do not have permission to upload a document for this donation.');
  }

  if (payload.donationType === 'donation_out' && !admin) {
    throw new Error('Only admins can upload outgoing donation documents.');
  }

  if (!donation && !payload.donatedAt) {
    throw new Error('donatedAt is required when uploading a document before creating a donation.');
  }

  var folders = ensureDriveFolders();
  var parentFolderId = payload.donationType === 'donation_in'
    ? folders.donationInFolderId
    : folders.donationOutFolderId;
  var targetFolder = getOrCreateDonationDateFolder(parentFolderId, donation ? donation.donated_at : payload.donatedAt);
  var bytes = decodeBase64(payload.base64);
  var blob = Utilities.newBlob(bytes, payload.mimeType, sanitizeFileName(payload.fileName));
  var file = targetFolder.createFile(blob);

  if (getOptionalProperty('DOCUMENT_LINK_ACCESS') === 'public') {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }

  var documentRows = supabaseRest('documents', 'post', {
    drive_file_id: file.getId(),
    url: file.getUrl(),
    mime_type: payload.mimeType,
    file_name: file.getName(),
    folder_type: payload.donationType,
    uploaded_by: user.id
  }, '', { prefer: 'return=representation' });

  if (!documentRows.length) {
    throw new Error('Document row was not created.');
  }

  if (payload.donationId) {
    var table = payload.donationType === 'donation_in' ? 'donations_in' : 'donations_out';
    supabaseRest(
      table,
      'patch',
      { document_id: documentRows[0].id },
      '?id=eq.' + encodeURIComponent(payload.donationId),
      { prefer: 'return=minimal' }
    );
  }

  return {
    ok: true,
    document: documentRows[0]
  };
}

function getDocumentFile(payload) {
  requireFields(payload, ['accessToken', 'donationType', 'donationId']);

  if (payload.donationType !== 'donation_in' && payload.donationType !== 'donation_out') {
    throw new Error('donationType must be donation_in or donation_out.');
  }

  var user = verifySupabaseUser(payload.accessToken);
  var admin = isAdmin(user.id);
  var donation = getDonationRecord(payload.donationType, payload.donationId);

  if (payload.donationType === 'donation_in' && donation.user_id !== user.id && !admin) {
    throw new Error('You do not have permission to view this document.');
  }

  var documentId = payload.documentId || donation.document_id;

  if (payload.donationType === 'donation_out' && documentId !== donation.document_id) {
    if (!admin && (donation.status !== 'success' || donation.deleted_at)) {
      throw new Error('This donation-out page is not available.');
    }

    ensureDonationOutMediaCanBeViewed(documentId, donation.id, admin);
  }

  if (payload.donationType === 'donation_in' && documentId !== donation.document_id) {
    throw new Error('Document does not belong to this donation.');
  }

  var documents = supabaseRest(
    'documents',
    'get',
    null,
    '?select=*&id=eq.' + encodeURIComponent(documentId) + '&limit=1',
    {}
  );

  if (!documents.length) {
    throw new Error('Document was not found.');
  }

  var document = documents[0];
  var file = DriveApp.getFileById(document.drive_file_id);
  var blob = file.getBlob();
  var bytes = blob.getBytes();
  var maxBytes = Number(getOptionalProperty('DOCUMENT_PREVIEW_MAX_BYTES') || 10485760);

  if (bytes.length > maxBytes) {
    throw new Error('Document is too large to preview. Use the Drive link to view it.');
  }

  return {
    ok: true,
    document: {
      id: document.id,
      drive_file_id: document.drive_file_id,
      url: document.url,
      file_name: document.file_name,
      mime_type: document.mime_type,
      base64: Utilities.base64Encode(bytes)
    }
  };
}

function ensureDonationOutMediaCanBeViewed(documentId, donationId, admin) {
  var mediaRows = supabaseRest(
    'donation_out_media',
    'get',
    null,
    '?select=donation_out_id,document_id&donation_out_id=eq.' +
      encodeURIComponent(donationId) +
      '&document_id=eq.' +
      encodeURIComponent(documentId) +
      '&limit=1',
    {}
  );

  if (!mediaRows.length) {
    throw new Error('Document does not belong to this donation-out page.');
  }

  if (admin) return;

  var detailRows = supabaseRest(
    'donation_out_details',
    'get',
    null,
    '?select=is_published&donation_out_id=eq.' + encodeURIComponent(donationId) + '&limit=1',
    {}
  );

  if (!detailRows.length || detailRows[0].is_published !== true) {
    throw new Error('This donation-out page is not published.');
  }
}

function createSnapshot(payload) {
  requireFields(payload, ['accessToken']);

  var user = verifySupabaseUser(payload.accessToken);
  if (!isAdmin(user.id)) {
    throw new Error('Only admins can create database snapshots.');
  }

  var folders = ensureDriveFolders();
  var snapshotRoot = DriveApp.getFolderById(folders.snapshotFolderId);
  var snapshotName = payload.name || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd-HHmmss');
  var snapshotFolder = snapshotRoot.createFolder(sanitizeFileName(snapshotName));
  var spreadsheet = SpreadsheetApp.create(snapshotName);
  var spreadsheetFile = DriveApp.getFileById(spreadsheet.getId());
  spreadsheetFile.moveTo(snapshotFolder);

  TABLES_TO_SNAPSHOT.forEach(function(tableName, index) {
    var rows = supabaseRest(tableName, 'get', null, '?select=*', {});
    var sheet = index === 0 ? spreadsheet.getSheets()[0] : spreadsheet.insertSheet();
    sheet.setName(tableName);
    writeRowsToSheet(sheet, rows);
  });

  return {
    ok: true,
    snapshotName: snapshotName,
    spreadsheetId: spreadsheet.getId(),
    url: spreadsheet.getUrl()
  };
}

function verifySupabaseUser(accessToken) {
  var supabaseUrl = getProperty('SUPABASE_URL');
  var apiKey = getOptionalProperty('SUPABASE_PUBLISHABLE_KEY') ||
    getOptionalProperty('SUPABASE_ANON_KEY') ||
    getServerKey();
  var response = UrlFetchApp.fetch(trimSlash(supabaseUrl) + '/auth/v1/user', {
    method: 'get',
    muteHttpExceptions: true,
    headers: {
      apikey: apiKey,
      Authorization: 'Bearer ' + accessToken
    }
  });

  if (response.getResponseCode() !== 200) {
    throw new Error('Invalid or expired Supabase access token.');
  }

  return JSON.parse(response.getContentText());
}

function isAdmin(userId) {
  var rows = supabaseRest(
    'profiles',
    'get',
    null,
    '?select=role_id,is_active&id=eq.' + encodeURIComponent(userId) + '&limit=1',
    {}
  );

  return rows.length > 0 && Number(rows[0].role_id) === 1 && rows[0].is_active === true;
}

function getDonationRecord(donationType, donationId) {
  var table = donationType === 'donation_in' ? 'donations_in' : 'donations_out';
  var rows = supabaseRest(
    table,
    'get',
    null,
    '?select=*&id=eq.' + encodeURIComponent(donationId) + '&limit=1',
    {}
  );

  if (!rows.length) {
    throw new Error('Donation record was not found.');
  }

  return rows[0];
}

function supabaseRest(tableName, method, body, query, options) {
  var supabaseUrl = getProperty('SUPABASE_URL');
  var serverKey = getServerKey();
  var headers = {
    apikey: serverKey,
    Authorization: 'Bearer ' + serverKey
  };

  if (body !== null && body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (options && options.prefer) {
    headers.Prefer = options.prefer;
  }

  var response = UrlFetchApp.fetch(
    trimSlash(supabaseUrl) + '/rest/v1/' + tableName + (query || ''),
    {
      method: method,
      muteHttpExceptions: true,
      headers: headers,
      payload: body === null || body === undefined ? undefined : JSON.stringify(body)
    }
  );
  var status = response.getResponseCode();
  var text = response.getContentText();

  if (status < 200 || status >= 300) {
    throw new Error('Supabase REST error for ' + tableName + ': ' + text);
  }

  return text ? JSON.parse(text) : [];
}

function writeRowsToSheet(sheet, rows) {
  sheet.clear();

  if (!rows.length) {
    sheet.getRange(1, 1).setValue('No rows');
    return;
  }

  var headers = Object.keys(rows[0]);
  var values = rows.map(function(row) {
    return headers.map(function(header) {
      var value = row[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      return value;
    });
  });

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

function getOrCreateDonationDateFolder(parentFolderId, donatedAt) {
  var parentFolder = DriveApp.getFolderById(parentFolderId);
  var date = donatedAt ? new Date(donatedAt) : new Date();
  var year = String(date.getFullYear());
  var month = Utilities.formatDate(date, Session.getScriptTimeZone(), 'MMM');
  var yearFolder = getOrCreateChildFolder(parentFolder, year);

  return getOrCreateChildFolder(yearFolder, month);
}

function ensureDriveFolders() {
  var scriptProperties = PropertiesService.getScriptProperties();
  var rootFolder = getOrCreateRootFolder(scriptProperties);
  var documentsFolder = getOrCreateChildFolder(rootFolder, 'documents');
  var donationInFolder = getOrCreateChildFolder(documentsFolder, 'donations-in');
  var donationOutFolder = getOrCreateChildFolder(documentsFolder, 'donations-out');
  var snapshotsFolder = getOrCreateChildFolder(rootFolder, 'snapshots');
  var databaseSnapshotsFolder = getOrCreateChildFolder(snapshotsFolder, 'database');
  var exportsFolder = getOrCreateChildFolder(rootFolder, 'exports');
  var adminNotesFolder = getOrCreateChildFolder(rootFolder, 'admin-notes');

  ensureDateFolders(donationInFolder);
  ensureDateFolders(donationOutFolder);

  var folders = {
    appRootFolderId: rootFolder.getId(),
    documentsFolderId: documentsFolder.getId(),
    donationInFolderId: donationInFolder.getId(),
    donationOutFolderId: donationOutFolder.getId(),
    snapshotFolderId: databaseSnapshotsFolder.getId(),
    exportsFolderId: exportsFolder.getId(),
    adminNotesFolderId: adminNotesFolder.getId()
  };

  scriptProperties.setProperty('DRIVE_APP_ROOT_FOLDER_ID', folders.appRootFolderId);
  scriptProperties.setProperty('DRIVE_DONATION_IN_FOLDER_ID', folders.donationInFolderId);
  scriptProperties.setProperty('DRIVE_DONATION_OUT_FOLDER_ID', folders.donationOutFolderId);
  scriptProperties.setProperty('DRIVE_SNAPSHOT_FOLDER_ID', folders.snapshotFolderId);

  return folders;
}

function getOrCreateRootFolder(scriptProperties) {
  var configuredRootFolderId = scriptProperties.getProperty('DRIVE_APP_ROOT_FOLDER_ID');

  if (configuredRootFolderId) {
    return DriveApp.getFolderById(configuredRootFolderId);
  }

  var existing = DriveApp.getFoldersByName(APP_ROOT_FOLDER_NAME);
  if (existing.hasNext()) {
    return existing.next();
  }

  return DriveApp.createFolder(APP_ROOT_FOLDER_NAME);
}

function getOrCreateChildFolder(parentFolder, folderName) {
  var existing = parentFolder.getFoldersByName(folderName);

  if (existing.hasNext()) {
    return existing.next();
  }

  return parentFolder.createFolder(folderName);
}

function ensureDateFolders(parentFolder) {
  var currentYear = new Date().getFullYear();
  var years = [2025, currentYear, currentYear + 1];

  years.forEach(function(year) {
    var yearFolder = getOrCreateChildFolder(parentFolder, String(year));
    ensureMonthFolders(yearFolder);
  });
}

function ensureMonthFolders(yearFolder) {
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  months.forEach(function(month) {
    getOrCreateChildFolder(yearFolder, month);
  });
}

function isAllowedDonationOutMediaType(mimeType) {
  return String(mimeType).indexOf('image/') === 0 || String(mimeType).indexOf('video/') === 0;
}

function decodeBase64(value) {
  var clean = String(value).replace(/^data:[^;]+;base64,/, '');
  return Utilities.base64Decode(clean);
}

function parsePayload(event) {
  if (!event || !event.postData || !event.postData.contents) {
    throw new Error('Missing request body.');
  }

  return JSON.parse(event.postData.contents);
}

function requireFields(payload, fields) {
  fields.forEach(function(field) {
    if (!payload[field]) {
      throw new Error('Missing required field: ' + field);
    }
  });
}

function getProperty(name) {
  var value = getOptionalProperty(name);
  if (!value) {
    throw new Error('Missing Apps Script property: ' + name);
  }
  return value;
}

function getOptionalProperty(name) {
  return PropertiesService.getScriptProperties().getProperty(name);
}

function getServerKey() {
  return getOptionalProperty('SUPABASE_SECRET_KEY') || getProperty('SUPABASE_SERVICE_ROLE_KEY');
}

function sanitizeFileName(fileName) {
  return String(fileName).replace(/[\\/:*?"<>|#{}%~&]/g, '-').slice(0, 120);
}

function trimSlash(value) {
  return String(value).replace(/\/+$/, '');
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
