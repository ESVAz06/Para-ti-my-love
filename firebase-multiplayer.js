(() => {
  const roomPath = "rooms/recuerdos-space/players";
  const updatesPerSecond = 8;

  function connect(options) {
    const config = window.memoryFirebaseConfig || {};
    const requiredConfig = ["apiKey", "authDomain", "databaseURL", "projectId", "appId"];
    const missingConfig = requiredConfig.filter((key) => !config[key]);

    if (missingConfig.length) {
      options.onStatus({ state: "setup", message: "Falta configurar Firebase", playerCount: 0 });
      return Promise.resolve({ publish() {}, disconnect() {} });
    }

    if (!window.firebase || !window.firebase.database || !window.firebase.auth) {
      options.onStatus({ state: "error", message: "No cargó Firebase; revisa tu conexión", playerCount: 0 });
      return Promise.resolve({ publish() {}, disconnect() {} });
    }

    return (async () => {
      try {
        const firebase = window.firebase;
        const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(config);
        const auth = app.auth();
        await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
        const credential = auth.currentUser
          ? { user: auth.currentUser }
          : await auth.signInAnonymously();
        const user = credential.user;
        const database = app.database();
        const playersRef = database.ref(roomPath);
        const playerRef = playersRef.child(user.uid);
        const onlinePlayers = new Set();
        let isConnected = false;
        let lastPublishAt = 0;
        let publishingDisabled = false;
        let failureMessage = "";

        const reportStatus = (message) => {
          if (failureMessage) {
            options.onStatus({
              state: "error",
              message: failureMessage,
              playerCount: onlinePlayers.size
            });
            return;
          }
          options.onStatus({
            state: isConnected ? "connected" : "connecting",
            message,
            playerCount: onlinePlayers.size
          });
        };
        const handlePlayer = (snapshot) => {
          if (snapshot.key === user.uid) return;
          const value = snapshot.val();
          if (!isValidPlayerState(value)) {
            options.onPlayerRemoved(snapshot.key);
            return;
          }
          onlinePlayers.add(snapshot.key);
          options.onPlayerUpdated(snapshot.key, value);
          reportStatus(isConnected ? "Conectado" : "Reconectando…");
        };
        const handlePlayerRemoved = (snapshot) => {
          onlinePlayers.delete(snapshot.key);
          options.onPlayerRemoved(snapshot.key);
          reportStatus(isConnected ? "Conectado" : "Reconectando…");
        };

        playersRef.on("child_added", handlePlayer);
        playersRef.on("child_changed", handlePlayer);
        playersRef.on("child_removed", handlePlayerRemoved);

        const connectionRef = database.ref(".info/connected");
        const handleConnection = async (snapshot) => {
          isConnected = snapshot.val() === true;
          if (!isConnected) {
            reportStatus("Reconectando…");
            return;
          }
          if (failureMessage) {
            reportStatus(failureMessage);
            return;
          }
          try {
            await playerRef.onDisconnect().remove();
            await playerRef.set(createInitialPlayerState(user.uid, options.profile));
            reportStatus("Conectado");
          } catch (error) {
            publishingDisabled = true;
            failureMessage = `Firebase rechazó la conexión: ${error.message}`;
            reportStatus(failureMessage);
            console.error("No se pudo registrar la presencia multijugador.", error);
          }
        };
        connectionRef.on("value", handleConnection);
        options.onStatus({ state: "connecting", message: "Conectando…", playerCount: 0 });

        return {
          publish(state) {
            const now = Date.now();
            if (!isConnected || publishingDisabled || now - lastPublishAt < 1000 / updatesPerSecond) return;
            lastPublishAt = now;
            if (!isValidPlayerState(state, false)) {
              publishingDisabled = true;
              failureMessage = "No se pudo sincronizar una posición inválida";
              reportStatus(failureMessage);
              return;
            }
            playerRef.update({
              position: state.position,
              rotation: state.rotation,
              shipPosition: state.shipPosition,
              shipRotation: state.shipRotation,
              jetpack: state.jetpack,
              boosting: state.boosting,
              name: normalizePlayerName(state.name),
              shipColor: normalizePlayerColor(state.shipColor, 0xd8d1ec),
              characterColor: normalizePlayerColor(state.characterColor),
              updatedAt: firebase.database.ServerValue.TIMESTAMP
            }).catch((error) => {
              publishingDisabled = true;
              failureMessage = `Falló la sincronización: ${error.message}`;
              reportStatus(failureMessage);
              console.error("No se pudo sincronizar la posición multijugador.", error);
            });
          },
          async disconnect() {
            connectionRef.off("value", handleConnection);
            playersRef.off("child_added", handlePlayer);
            playersRef.off("child_changed", handlePlayer);
            playersRef.off("child_removed", handlePlayerRemoved);
            await playerRef.onDisconnect().cancel();
            await playerRef.remove();
          }
        };
      } catch (error) {
        options.onStatus({
          state: "error",
          message: `No se pudo iniciar Firebase: ${error.message}`,
          playerCount: 0
        });
        console.error("Error iniciando multijugador con Firebase.", error);
        return { publish() {}, disconnect() {} };
      }
    })();
  }

  function createInitialPlayerState(uid, profile = {}) {
    const offset = (uid.codePointAt(0) % 9) * 2;
    return {
      position: { x: offset, y: 0, z: 58 },
      rotation: { x: 0, y: 0, z: 0 },
      shipPosition: { x: offset, y: 0, z: 58 },
      shipRotation: { x: 0, y: 0, z: 0 },
      jetpack: false,
      boosting: false,
      name: normalizePlayerName(profile.name),
      shipColor: normalizePlayerColor(profile.shipColor, 0xd8d1ec),
      characterColor: normalizePlayerColor(profile.characterColor),
      updatedAt: Date.now()
    };
  }

  function normalizePlayerName(name) {
    return typeof name === "string" ? name.trim().replace(/\s+/g, " ").slice(0, 24) || "Explorador" : "Explorador";
  }

  function normalizePlayerColor(color, fallback = 0xcac9dd) {
    if (Number.isInteger(color) && color >= 0 && color <= 0xffffff) return color;
    if (typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)) return Number.parseInt(color.slice(1), 16);
    return fallback;
  }

  function isValidPlayerState(value, requireTimestamp = true) {
    if (!value || typeof value !== "object") return false;
    const vectorKeys = ["x", "y", "z"];
    const vectors = [value.position, value.rotation, value.shipPosition, value.shipRotation];
    if (!vectors.every((vector) => vector && vectorKeys.every((key) =>
      Number.isFinite(vector[key]) && Math.abs(vector[key]) <= 100000
    ))) return false;
    return typeof value.jetpack === "boolean" &&
      typeof value.boosting === "boolean" &&
      (value.name === undefined || (typeof value.name === "string" && value.name.length > 0 && value.name.length <= 24)) &&
      (value.shipColor === undefined || (Number.isInteger(value.shipColor) && value.shipColor >= 0 && value.shipColor <= 0xffffff)) &&
      (value.characterColor === undefined || (Number.isInteger(value.characterColor) && value.characterColor >= 0 && value.characterColor <= 0xffffff)) &&
      (requireTimestamp ? Number.isFinite(value.updatedAt) : value.updatedAt === undefined || Number.isFinite(value.updatedAt));
  }

  window.memoryMultiplayer = Object.freeze({ connect });
})();
