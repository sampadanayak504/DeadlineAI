// Service Worker for DeadlineAI persistent browser notifications and actions
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js');

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

// Listen to notification click events to perform actions
self.addEventListener('notificationclick', function(event) {
  const action = event.action;
  const notification = event.notification;
  const reminderId = notification.data ? notification.data.reminderId : null;
  const userId = notification.data ? notification.data.userId : null;
  const firebaseConfig = notification.data ? notification.data.firebaseConfig : null;

  notification.close();

  if (!reminderId || !userId || !firebaseConfig) {
    console.error("Missing notification payload data:", { reminderId, userId, firebaseConfig });
    return;
  }

  if (action === 'mark_done') {
    event.waitUntil(
      new Promise((resolve, reject) => {
        try {
          if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
          }
          const db = firebase.firestore();
          // 1. Complete the reminder in Firestore under reminders collection
          db.doc(`users/${userId}/reminders/${reminderId}`).update({
            completed: true,
            status: 'Completed',
            updatedAt: new Date().toISOString()
          })
          .then(() => {
            console.log("Successfully completed reminder via Service Worker:", reminderId);
            resolve();
          })
          .catch((err) => {
            console.error("Failed to complete reminder in SW:", err);
            reject(err);
          });
        } catch (e) {
          console.error("Firebase update error in SW:", e);
          reject(e);
        }
      })
    );
  } else if (action === 'snooze') {
    event.waitUntil(
      new Promise((resolve, reject) => {
        try {
          if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
          }
          const db = firebase.firestore();

          // Calculate 10 minutes in future
          const now = new Date();
          now.setMinutes(now.getMinutes() + 10);
          const nextTime = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
          const nextDate = now.toISOString().split('T')[0]; // YYYY-MM-DD

          // 2. Snooze updates Firestore under reminders collection
          db.doc(`users/${userId}/reminders/${reminderId}`).update({
            startTime: nextTime,
            time: nextTime,
            date: nextDate,
            status: 'Snoozed',
            updatedAt: new Date().toISOString()
          })
          .then(() => {
            console.log("Successfully snoozed reminder via Service Worker:", reminderId);
            resolve();
          })
          .catch((err) => {
            console.error("Failed to snooze reminder in SW:", err);
            reject(err);
          });
        } catch (e) {
          console.error("Firebase snooze error in SW:", e);
          reject(e);
        }
      })
    );
  } else {
    // Standard notification click: open/focus client window
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
        for (var i = 0; i < clientList.length; i++) {
          var client = clientList[i];
          if (client.url && 'focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow('/');
        }
      })
    );
  }
});
