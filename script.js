function modelExplorer() {
    return {
        models: [], 
        cachedModels: null,
        providerFilterQuery: '',
        modalityFilterQuery: '',
        filters: {
            providers: [],
            modalities: [],
            pricing: []
        },
        statusLight: 'gray',
        sortField: 'name',
        sortDirection: 'asc',
        showProviderFilters: false,
        showNameFilters: false,
        showModalityFilters: false,
        showPricingFilters: false,
        showContextLengthFilters: false,
        searchQuery: '',
        nameFilterQuery: '',
        showColumns: false,
        selectedProviders: [],
        selectedModalities: [],
        selectedPricingTypes: [],
        contextLengthFilter: null,
        columns: [
            { 
                id: 'provider', 
                label: 'Provider', 
                description: 'The service or organization providing the AI model'
            },
            { 
                id: 'name', 
                label: 'Model Name', 
                description: 'Unique identifier and name of the AI model'
            },
            { 
                id: 'modality', 
                label: 'Modality', 
                description: 'Input and output capabilities of the model (text, image, etc.)'
            },
            { 
                id: 'pricing', 
                label: 'Pricing', 
                description: 'Cost structure for using the model (per token/request)'
            },
            { 
                id: 'contextLength', 
                label: 'Context Length', 
                description: 'Maximum number of tokens the model can process in a single request'
            }
        ],
        visibleColumns: ['provider', 'name', 'modality', 'pricing', 'contextLength'],
        
        init() {
            // Check for cached models
            const cachedData = localStorage.getItem('openRouterModels');
            const cachedTimestamp = localStorage.getItem('openRouterModelsTimestamp');
            
            // Use cached data if less than 1 hour old
            if (cachedData && cachedTimestamp && 
                (Date.now() - parseInt(cachedTimestamp) < 3600000)) {
                try {
                    this.models = JSON.parse(cachedData);
                    this.statusLight = 'green';
                    console.log('Loaded cached models:', this.models);
                } catch (error) {
                    console.error('Error parsing cached models:', error);
                }
            }
            
            // Always try to fetch fresh data
            this.fetchData();
            
            // Dark mode persistence
            if (localStorage.getItem('darkMode') === 'true') {
                document.documentElement.classList.add('dark');
                this.$root.darkMode = true;
            }
        },
        
        fetchData() {
            this.statusLight = 'yellow';
            let retries = 3;
            const fetchWithRetry = async () => {
                try {
                    const response = await fetch('https://openrouter.ai/api/v1/models', {
                        headers: {
                            'Accept': 'application/json'
                        }
                    });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    return response.json();
                } catch (error) {
                    if (retries > 0) {
                        retries--;
                        console.log(`Retrying... attempts left: ${retries}`);
                        await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries)));
                        return fetchWithRetry();
                    }
                    throw error;
                }
            };
            
            fetchWithRetry()
                .then(data => {
                    console.log('Raw API Response:', data);
                    
                    // Defensive data mapping with extensive logging
                    if (!data || !data.data || !Array.isArray(data.data)) {
                        throw new Error('Invalid data structure from API');
                    }
                    
                    this.models = data.data.map(model => {
                        // Defensive checks for each model property
                        if (!model.id || !model.name) {
                            console.warn('Skipping invalid model:', model);
                            return null;
                        }
                        
                        return {
                            id: model.id,
                            provider: model.id.split('/')[0] || 'Unknown',
                            name: model.name,
                            modality: model.architecture?.modality || 'Unknown',
                            pricing: {
                                prompt: model.pricing?.prompt || '0',
                                completion: model.pricing?.completion || '0',
                                image: model.pricing?.image || '0',
                                request: model.pricing?.request || '0'
                            },
                            contextLength: Math.round((model.context_length || 0) / 1000)
                        };
                    }).filter(Boolean); // Remove any null entries
                    
                    console.log('Processed Models:', this.models);
                    
                    // Validate models array
                    if (this.models.length === 0) {
                        throw new Error('No valid models found');
                    }
                    
                    // Cache models in localStorage
                    localStorage.setItem('openRouterModels', JSON.stringify(this.models));
                    localStorage.setItem('openRouterModelsTimestamp', Date.now().toString());
                    
                    this.statusLight = 'green';
                })
                .catch(error => {
                    console.error('Fetch error:', error);
                    this.statusLight = 'red';
                    
                    // Enhanced error logging
                    const errorDetails = {
                        message: error.message,
                        timestamp: new Date().toISOString(),
                        networkInfo: navigator.connection ? {
                            type: navigator.connection.type,
                            effectiveType: navigator.connection.effectiveType,
                            downlink: navigator.connection.downlink,
                            rtt: navigator.connection.rtt
                        } : null
                    };
                    
                    // Optional: Send error to logging service
                    this.logError(errorDetails);
                    
                    // User-friendly error notification
                    this.showNotification(
                        'Failed to load models. Using cached data or please check your connection.', 
                        'error'
                    );
                });
        },
        
        logError(errorDetails) {
            // Placeholder for potential error logging service
            console.error('Detailed Error:', JSON.stringify(errorDetails, null, 2));
        },
        
        showNotification(message, type = 'info') {
            const notification = document.createElement('div');
            notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
                type === 'error' ? 'bg-red-500 text-white' : 
                type === 'success' ? 'bg-green-500 text-white' : 
                'bg-blue-500 text-white'
            }`;
            notification.textContent = message;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.classList.add('animate-fade-out');
                setTimeout(() => document.body.removeChild(notification), 500);
            }, 3000);
        },
        
get filteredModels() {
    console.log('Applying filters:', {
        search: this.searchQuery,
        provider: this.providerFilterQuery,
        modality: this.modalityFilterQuery,
        pricing: this.pricingFilterQuery,
        contextLength: this.contextLengthFilter
    });

    const filtered = this.models.filter(model => {
        const matchesSearch = !this.searchQuery ||
            (model.name && model.name.toLowerCase().includes(this.searchQuery.toLowerCase())) ||
            (model.provider && model.provider.toLowerCase().includes(this.searchQuery.toLowerCase()));
        
        const matchesProvider = this.selectedProviders.length === 0 || 
            this.selectedProviders.some(selectedProvider => 
                model.provider.toLowerCase().includes(selectedProvider.toLowerCase())
            );
        
        const matchesModality = this.selectedModalities.length === 0 || 
            this.selectedModalities.some(modality => 
                model.modality.toLowerCase().includes(modality.toLowerCase())
            );
        
        const matchesPricing = this.selectedPricingTypes.length === 0 || 
            (this.selectedPricingTypes.includes('free') && this.isFreeModel(model)) || 
            (this.selectedPricingTypes.includes('paid') && !this.isFreeModel(model));
        
        const matchesContextLength = !this.contextLengthFilter ||
            model.contextLength >= this.contextLengthFilter;
        
        const result = matchesSearch && matchesProvider && matchesModality && matchesPricing && matchesContextLength;
        
        if (result) {
            console.log('Model matches filters:', model.name);
        }
        
        return result;
    });

    console.log('Filtered models count:', filtered.length);
    return filtered;
},

resetFilters() {
    this.searchQuery = '';
    this.selectedProviders = [];
    this.selectedModalities = [];
    this.selectedPricingTypes = [];
    this.contextLengthFilter = null;
},

getProviderIcon(provider) {
    const providerIcons = {
        'meta-llama': 'fab fa-facebook',
        'openai': 'fab fa-openai',
        'anthropic': 'fas fa-brain',
        'google': 'fab fa-google',
        'mistral': 'fas fa-wind',
        'cohere': 'fas fa-cubes'
    };
    
    const lowercaseProvider = provider.toLowerCase();
    const matchedIcon = Object.keys(providerIcons).find(key => 
        lowercaseProvider.includes(key)
    );
    
    return matchedIcon ? providerIcons[matchedIcon] : 'fas fa-robot';
},

        updateFilters() {
            console.log('Filters updated, refreshing table...');
            // Force reactivity by creating a new array
            this.models = [...this.models];
        },
        
        get availableProviders() {
            const providers = [...new Set(this.models.map(model => model.provider))].sort();
            console.log('Available providers:', providers);
            return providers;
        },
        
        get availableModalities() {
            const modalities = [...new Set(this.models.flatMap(model => model.modality.split('+').map(m => m.split('->')[0])))].sort();
            console.log('Available modalities:', modalities);
            return modalities;
        },
        
        getModalityIcons(modality) {
            const icons = {
                'text': 'fas fa-comment text-blue-500',
                'image': 'fas fa-image text-green-500',
                'audio': 'fas fa-microphone text-purple-500',
                'video': 'fas fa-video text-red-500'
            };
            
            return modality.split('+').map(m => {
                const type = m.split('->')[0];
                return icons[type] || 'fas fa-question-circle text-gray-500';
            });
        },
        
formatPricing(pricing, modelName) {
    const icons = {
        prompt: 'fas fa-comment',
        completion: 'fas fa-arrow-right',
        image: 'fas fa-image',
        request: 'fas fa-bolt'
    };
    
    const isFreeModel = Object.values(pricing).every(val => val === '0' || val === 'free') || 
                        modelName.toLowerCase().includes('free');
    
    if (isFreeModel) {
        return `
            <div class="flex items-center space-x-1">
                <i class="fas fa-gift text-green-500"></i>
                <span class="text-sm">Free</span>
                <span class="free-icon">FREE</span>
            </div>
        `;
    }
            
    return Object.entries(pricing)
        .filter(([_, value]) => value !== '0' && value !== 'free')
        .map(([type, value]) => {
            const numericValue = parseFloat(value);
            if (isNaN(numericValue)) return '';
            
            const costPerMillion = numericValue * 1000000;
            const formattedValue = `$${costPerMillion.toFixed(2)}/M`;
            
            return `
                <div class="flex items-center space-x-1">
                    <i class="${icons[type]} text-sm"></i>
                    <span class="text-sm">${formattedValue}</span>
                </div>
            `;
        }).join('') || 'N/A';
},
        
        copyModelId(id) {
            navigator.clipboard.writeText(id)
                .then(() => {
                    this.showNotification('Model ID copied to clipboard!', 'success');
                })
                .catch(() => {
                    this.showNotification('Failed to copy Model ID', 'error');
                });
        },
        
        sortBy(field) {
            if (this.sortField === field) {
                this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                this.sortField = field;
                this.sortDirection = 'asc';
            }
            
            this.models.sort((a, b) => {
                let valA = a[field];
                let valB = b[field];
                
                if (typeof valA === 'string') valA = valA.toLowerCase();
                if (typeof valB === 'string') valB = valB.toLowerCase();
                
                if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
                if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        },
        
isFreeModel(model) {
    return model.name.toLowerCase().includes('free') || 
           model.name.toLowerCase().includes('open source') ||
           Object.values(model.pricing).every(val => val === '0' || val === 'free');
}
    }
}
