{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.services.department-of-misinformation;
in
{
  options = {
    services.department-of-misinformation = {
      enable = lib.mkEnableOption "Enable the department-of-misinformation";

      host = lib.mkOption {
        type = lib.types.str;
        default = "localhost";
        example = "192.168.22.22";
        description = lib.mdDoc "Address to serve on.";
      };

      port = lib.mkOption {
        type = lib.types.int;
        default = 8087;
        example = 8087;
        description = lib.mdDoc "Port to serve on.";
      };

      origin = lib.mkOption {
        type = lib.types.str;
        default = "http://localhost:8087";
        example = "https://example.com";
        description = lib.mdDoc "Origin for CORS and stuff.";
      };

      package = lib.mkOption {
        type = lib.types.package;
        description = lib.mdDoc "department-of-misinformation package used for the service.";
        default = pkgs.department-of-misinformation;
        defaultText = lib.literalExpression "packages.pkgs.department-of-misinformation";
      };
    };
  };

  config = lib.mkIf cfg.enable (
    let
      dataDirectory = "/var/lib/department-of-misinformation";
      databaseFile = "${dataDirectory}/kv.sqlite";
    in
    {
      users.users."department-of-misinformation" = {
        isSystemUser = true;
        createHome = true;
        home = dataDirectory;
        group = "department-of-misinformation";
      };
      users.groups."department-of-misinformation" = { };

      systemd.services."department-of-misinformation" = {
        serviceConfig = {
          Type = "simple";
          User = "department-of-misinformation";
          Group = "department-of-misinformation";
          Restart = "on-failure";
          RestartSec = "30s";
          ExecStart = "${lib.getExe pkgs.department-of-misinformation}";
        };
        wantedBy = [ "multi-user.target" ];

        description = "The whole department of misinformation in one systemd service!";

        environment = {
          DATABASE_PATH = "${databaseFile}";
          HOST = "${cfg.host}";
          PORT = "${builtins.toString cfg.port}";
          ORIGIN = "${cfg.origin}";
        };

        documentation = [ "https://github.com/zebreus/department-of-misinformation" ];
      };
    }
  );
}
