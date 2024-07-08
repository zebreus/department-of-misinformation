{ stdenv
, lib
, buildDenoApplication
, ...
}:
buildDenoApplication {
  pname = "department-of-misinformation";
  version = "0-unstable";

  src = ./.;

  mainFile = "server.ts";
  depsHash = "sha256-ZdJ0AhiB9JU3pcPibcVW+xZwkdfHisKEx6ll22IJmac=";

  meta = {
    description = "An experimental activitypub server where my infra can post status updates";
    homepage = "https://github.com/zebreus/department-of-misinformation";
    license = lib.licenses.agpl3Only;
    maintainers = with lib.maintainers; [ zebreus ];
    platforms = lib.platforms.linux;
    mainProgram = "department-of-misinformation";
  };
}
