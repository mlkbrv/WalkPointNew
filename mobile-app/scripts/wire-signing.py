"""Reapply the release signing config after `expo prebuild --clean`.

android/ is generated and gitignored, so the signing block does not survive a
prebuild. Kept as a script rather than a config plugin because the passwords
must not end up in app.json.
"""
import json
import pathlib
import re

creds = json.load(open("credentials.json"))["android"]["keystore"]
android = pathlib.Path("android")
keystore = (pathlib.Path.cwd() / creds["keystorePath"]).resolve()
assert keystore.exists(), keystore

(android / "keystore.properties").write_text(
    "# Local release signing. Gitignored — it holds the key password.\n"
    f"storeFile={keystore.as_posix()}\n"
    f"storePassword={creds['keystorePassword']}\n"
    f"keyAlias={creds['keyAlias']}\n"
    f"keyPassword={creds['keyPassword']}\n",
    encoding="utf-8",
)

p = android / "app" / "build.gradle"
s = p.read_text(encoding="utf-8")
if "signingConfigs.release" not in s:
    s = s.replace("""    signingConfigs {
        debug {""", """    signingConfigs {
        release {
            def props = new Properties()
            def propsFile = rootProject.file('keystore.properties')
            if (propsFile.exists()) {
                propsFile.withInputStream { props.load(it) }
                storeFile file(props['storeFile'])
                storePassword props['storePassword']
                keyAlias props['keyAlias']
                keyPassword props['keyPassword']
            }
        }
        debug {""", 1)
    s = re.sub(r"(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug",
               r"\1signingConfig signingConfigs.release", s, count=1)
    p.write_text(s, encoding="utf-8")
print("signing wired")
