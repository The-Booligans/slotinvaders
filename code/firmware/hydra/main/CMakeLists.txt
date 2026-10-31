set(requires
    coco_detect
    esp32-camera
    esp_wifi
    esp_event
    esp_netif
    esp_http_client
    esp-tls
    nvs_flash
)

idf_component_register(SRCS "hydra.cpp"
                       INCLUDE_DIRS "."
                       REQUIRES ${requires})
