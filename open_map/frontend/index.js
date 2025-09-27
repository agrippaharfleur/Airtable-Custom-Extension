import React, { useEffect, useRef } from 'react';
import { initializeBlock, useBase, useRecords, useCustomProperties } from '@airtable/blocks/interface/ui';
import { FieldType } from '@airtable/blocks/interface/models';
import './style.css';

function PostalCodeMap() {
    const base = useBase();
    const table = base.tables[0];
    const records = useRecords(table);
    
    const { customPropertyValueByKey } = useCustomProperties(getCustomProperties);
    const latitudeField = customPropertyValueByKey['latitude_field'];
    const longitudeField = customPropertyValueByKey['longitude_field'];
    const customEmoji = customPropertyValueByKey['marker_emoji'] || '🦙';
    const mapTheme = customPropertyValueByKey['map_theme'] || 'dark';
    
    if (!latitudeField || !longitudeField) {
        return (
            <div className="w-full h-screen flex items-center justify-center bg-gray-gray50 dark:bg-gray-gray800">
                <div className="text-center p-6 bg-white dark:bg-gray-gray700 rounded-lg shadow-sm">
                    <h2 className="text-xl font-semibold text-gray-gray700 dark:text-gray-gray200 mb-2">
                        Configuration requise
                    </h2>
                    <p className="text-gray-gray500 dark:text-gray-gray400">
                        Veuillez sélectionner les champs Latitude et Longitude dans les propriétés de l'extension.
                    </p>
                </div>
            </div>
        );
    }
    
    // Extraire les coordonnées des enregistrements
    const coordinates = records
        .map(record => {
            const lat = record.getCellValue(latitudeField);
            const lng = record.getCellValue(longitudeField);
            
            // Vérifier que les coordonnées sont valides
            if (lat !== null && lng !== null && 
                typeof lat === 'number' && typeof lng === 'number' &&
                lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                return { lat, lng, record };
            }
            return null;
        })
        .filter(coord => coord !== null);
    
    return (
        <div className={`w-full h-screen ${mapTheme === 'dark' ? 'bg-gray-gray900' : 'bg-gray-gray50 dark:bg-gray-gray800'}`}>
            <div className={`absolute top-4 left-4 z-10 ${mapTheme === 'dark' ? 'bg-gray-gray800 border border-gray-gray600' : 'bg-white dark:bg-gray-gray700 border border-gray-gray200 dark:border-gray-gray600'} px-4 py-2 rounded-lg shadow-lg`}>
                <p className={`text-sm ${mapTheme === 'dark' ? 'text-gray-gray200' : 'text-gray-gray600 dark:text-gray-gray300'}`}>
                    {customEmoji} {coordinates.length} point{coordinates.length > 1 ? 's' : ''} affiché{coordinates.length > 1 ? 's' : ''}
                </p>
            </div>
            
            <div className="w-full h-full">
                <SimpleMapComponent coordinates={coordinates} emoji={customEmoji} theme={mapTheme} />
            </div>
        </div>
    );
}

function SimpleMapComponent({ coordinates, emoji, theme }) {
    const mapContainerRef = useRef(null);
    
    useEffect(() => {
        // Injecter le CSS et JS de Leaflet directement dans le head
        if (!document.querySelector('#leaflet-css')) {
            const cssLink = document.createElement('link');
            cssLink.id = 'leaflet-css';
            cssLink.rel = 'stylesheet';
            cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(cssLink);
        }
        
        // Ajouter le CSS pour les émojis lamas avec ombre
        if (!document.querySelector('#emoji-marker-css')) {
            const style = document.createElement('style');
            style.id = 'emoji-marker-css';
            style.textContent = `
                .emoji-marker {
                    background: none !important;
                    border: none !important;
                    font-size: 28px;
                    text-align: center;
                    line-height: 28px;
                    cursor: pointer;
                    transform: translate(-50%, -50%);
                }
                .emoji-marker:hover {
                    transform: translate(-50%, -50%) scale(1.3);
                    transition: transform 0.2s ease;
                }
            `;
            document.head.appendChild(style);
        }
        
        if (!document.querySelector('#leaflet-js')) {
            const script = document.createElement('script');
            script.id = 'leaflet-js';
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.onload = initializeMap;
            document.head.appendChild(script);
        } else if (window.L) {
            initializeMap();
        }
    }, [coordinates]);
    
    const initializeMap = () => {
        if (!mapContainerRef.current || !window.L || coordinates.length === 0) {
            return;
        }
        
        try {
            // Nettoyer le conteneur s'il y a déjà une carte
            mapContainerRef.current.innerHTML = '';
            
            // Calculer le centre des coordonnées
            const lats = coordinates.map(c => c.lat);
            const lngs = coordinates.map(c => c.lng);
            const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
            const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
            
            // Créer la carte
            const map = window.L.map(mapContainerRef.current, {
                center: [centerLat, centerLng],
                zoom: 6
            });
            
            // Ajouter les tuiles selon le thème choisi
            if (theme === 'dark') {
                // CartoDB Dark Matter
                window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                    subdomains: 'abcd',
                    maxZoom: 20
                }).addTo(map);
            } else {
                // CartoDB Positron (clair)
                window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                    subdomains: 'abcd',
                    maxZoom: 20
                }).addTo(map);
            }
            
            // Créer une icône personnalisée avec l'émoji choisi
            const customIcon = window.L.divIcon({
                html: emoji,
                className: 'emoji-marker',
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            });
            
            // Ajouter les marqueurs avec l'émoji personnalisé
            const markers = coordinates.map(coord => {
                return window.L.marker([coord.lat, coord.lng], {
                    icon: customIcon
                }).addTo(map);
            });
            
            // Ajuster la vue pour inclure tous les points
            if (markers.length > 1) {
                const group = new window.L.featureGroup(markers);
                map.fitBounds(group.getBounds().pad(0.1));
            }
            
        } catch (error) {
            console.error('Erreur lors de l\'initialisation de la carte:', error);
            if (mapContainerRef.current) {
                mapContainerRef.current.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #9ca3af; font-size: 16px; background: #1f2937;">
                        Erreur lors du chargement de la carte
                    </div>
                `;
            }
        }
    };
    
            if (coordinates.length === 0) {
        return (
            <div className={`w-full h-full flex items-center justify-center ${theme === 'dark' ? 'bg-gray-gray900' : 'bg-gray-gray50'}`}>
                <div className={`${theme === 'dark' ? 'text-gray-gray300' : 'text-gray-gray600'} text-lg`}>
                    Aucune coordonnée valide trouvée
                </div>
            </div>
        );
    }
    
    return (
        <div 
            ref={mapContainerRef} 
            className="w-full h-full"
            style={{ minHeight: '400px' }}
        />
    );
}

function getCustomProperties(base) {
    const table = base.tables[0];
    
    // Champs numériques pour les coordonnées
    const numericFields = table.fields.filter(field => 
        field.type === FieldType.NUMBER || 
        field.type === FieldType.PERCENT ||
        field.type === FieldType.CURRENCY
    );
    
    return [
        {
            key: 'latitude_field',
            label: 'Champ Latitude',
            type: 'field',
            table,
            possibleValues: numericFields,
        },
        {
            key: 'longitude_field',
            label: 'Champ Longitude', 
            type: 'field',
            table,
            possibleValues: numericFields,
        },
        {
            key: 'marker_emoji',
            label: 'Emoji du marqueur',
            type: 'string',
            defaultValue: '📍',
        },
        {
            key: 'map_theme',
            label: 'Thème de la carte',
            type: 'enum',
            possibleValues: [
                { value: 'light', label: 'Clair' },
                { value: 'dark', label: 'Sombre' }
            ],
            defaultValue: 'dark',
        }
    ];
}

initializeBlock({ interface: () => <PostalCodeMap /> });