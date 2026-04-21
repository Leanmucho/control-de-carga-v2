# Cómo generar el APK para Android

## Requisitos previos

1. Tener una cuenta en https://expo.dev (gratuita)
2. Instalar EAS CLI:
   ```
   npm install -g eas-cli
   ```
3. Iniciar sesión:
   ```
   eas login
   ```

## Configurar proyecto en Expo (una sola vez)

```bash
eas init --id <pegar-tu-project-id>
```

O ir a https://expo.dev y crear un nuevo proyecto llamado "control-carga".
Copiar el Project ID y pegarlo en `app.json` → `extra.eas.projectId`.

## Generar APK (preview = APK instalable)

```bash
eas build --platform android --profile preview
```

Esto tarda ~5-10 minutos y genera un link para descargar el .apk directamente.

## Instalar en el teléfono

1. Descargar el .apk desde el link que da EAS
2. En el teléfono: Ajustes → Seguridad → Activar "Fuentes desconocidas"
3. Abrir el archivo .apk descargado
4. Instalar y listo

## Actualizar versión

Cada vez que hagas cambios importantes:
1. Subir `versionCode` en `app.json` → `android.versionCode`
2. Volver a correr `eas build --platform android --profile preview`

## Build de producción (Play Store, opcional)

```bash
eas build --platform android --profile production
```

Genera un .apk para distribución (firma automática).
