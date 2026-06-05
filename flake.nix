{
  description = "blog";

  inputs = {
    nixpkgs.url = "nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    zola-quorum-schematics = {
      url = "github:PierreZ/zola-quorum-schematics/ccef242f012fdd8cc2daca218873e18a82bb28c0";
      flake = false;
    };
  };

  outputs = { self, nixpkgs, flake-utils, zola-quorum-schematics }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [ pkgs.git pkgs.zola ];
          shellHook = ''
            mkdir -p themes
            # Copy instead of symlink: Zola preserves file permissions when
            # copying theme static files into public/, and nix-store files are
            # read-only, which breaks overriding them from the site's static/.
            rm -rf themes/zola-quorum-schematics
            cp -r --no-preserve=mode,timestamps ${zola-quorum-schematics} themes/zola-quorum-schematics
          '';
        };
      });
}