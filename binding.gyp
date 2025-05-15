{
  "targets": [
    {
      "target_name": "native",
      "sources": [
        "src/truth.cpp"
      ],
      "cflags!": [],
      "cflags_cc!": [],
      "link_settings": {
        "libraries": [
          "-lgmp"
        ]
      },
      "dependencies": [
        "<!(node -p \"require('node-addon-api').targets\"):node_addon_api"
      ]
    }
  ]
}