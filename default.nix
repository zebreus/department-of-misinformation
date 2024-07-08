{ lib, buildDenoApplication, ... }:
buildDenoApplication {
  pname = "department-of-misinformation";
  version = "0-unstable";

  src = ./.;

  mainFile = "server.ts";
  depsHash = "sha256-9Jww8A2tDxHgouVSx+1MCJ6TGc54HFo8+hAm+DNTTNk=";

  meta = {
    description = "An experimental activitypub server where my infra can post status updates";
    homepage = "https://github.com/zebreus/department-of-misinformation";
    license = lib.licenses.agpl3Only;
    maintainers = with lib.maintainers; [ zebreus ];
    platforms = lib.platforms.linux;
    mainProgram = "department-of-misinformation";
  };
}
