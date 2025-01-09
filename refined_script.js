function modelExplorer() {
    return {
        // State Management with Performance Optimizations
        models: [],
        cachedModels: null,
        statusLight: 'gray',
        sortField: 'name',
        sortDirection: 'asc',
        
        // Search and Filter State
        searchQuery: '',
        providerFilterQuery: '',
        modalityFilterQuery: '',
        showProviderFilters: false,
        showModalityFilters: false,
        showPricingFilters: false,
        showContextLengthFilters: false,
        selectedProviders: [],
        selectedModalities: [],
        selectedPricingTypes: [],
        contextLengthFilter: null,
        
        // Column Definitions
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

        // Quick Filter Functionality
        quickFilter(provider) {
            if (provider === 'meta') {
                this.selectedProviders = ['meta-llama'];
            } else {
                const index = this.selectedProviders.indexOf(provider);
                if (index === -1) {
                    this.selectedProviders = [provider];
                } else {
                    this.selectedProviders = [];
                }
            }
        },
        quickFilter(provider) {
            const index = this.selectedProviders.indexOf(provider);
            if (index === -1) {
                this.selectedProviders = [provider];
            } else {
                this.selectedProviders = [];
            }
        },
        
        // Initialization
        init() {
            this.loadCachedModels();
            this.fetchData();
            this.initDarkMode();
            this.setupIntersectionObserver();
        },
        
        // Performance Optimized Data Loading
        loadCachedModels() {
            const cachedData = localStorage.getItem('openRouterModels');
            const cachedTimestamp = localStorage.getItem('openRouterModelsTimestamp');
            
            if (this.isValidCache(cachedData, cachedTimestamp)) {
                try {
                    this.models = JSON.parse(cachedData);
                    this.statusLight = 'green';
                    console.log('Loaded cached models:', this.models);
                } catch (error) {
                    console.error('Error parsing cached models:', error);
                    this.showNotification('Error loading cached models', 'error');
                }
            }
        },
        
        isValidCache(cachedData, cachedTimestamp, maxAge = 3600000) {
            return cachedData && 
                   cachedTimestamp && 
                   (Date.now() - parseInt(cachedTimestamp) < maxAge);
        },
        
        // Data Fetching with Error Handling
        async fetchData() {
            this.statusLight = 'yellow';
            
            try {
                const response = await fetch('https://openrouter.ai/api/v1/models', {
                    headers: { 
                        'Accept': 'application/json',
                        'HTTP-Referer': window.location.href,
                        'X-Title': 'OpenRouter Models Explorer'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                await this.processModelData(data);
                this.showNotification('Models loaded successfully', 'success');
            } catch (error) {
                console.error('Fetch error:', error);
                this.handleFetchError(error);
            }
        },
        
        async processModelData(data) {
            if (!data?.data || !Array.isArray(data.data)) {
                throw new Error('Invalid data structure from API');
            }
            
            this.models = data.data.map(model => ({
                id: model.id || '',
                provider: (model.id || '').split('/')[0] || 'Unknown',
                name: model.name || 'Unknown',
                modality: model.architecture?.modality || 'Unknown',
                pricing: {
                    prompt: model.pricing?.prompt || '0',
                    completion: model.pricing?.completion || '0',
                    image: model.pricing?.image || '0',
                    request: model.pricing?.request || '0'
                },
                contextLength: Math.round((model.context_length || 0) / 1000)
            })).filter(model => model.id && model.name);
            
            if (this.models.length === 0) {
                throw new Error('No valid models found');
            }
            
            this.cacheModels();
            this.statusLight = 'green';
        },
        
        cacheModels() {
            try {
                localStorage.setItem('openRouterModels', JSON.stringify(this.models));
                localStorage.setItem('openRouterModelsTimestamp', Date.now().toString());
            } catch (error) {
                console.error('Error caching models:', error);
            }
        },
        
        handleFetchError(error) {
            console.error('Fetch error:', error);
            this.statusLight = 'red';
            this.showNotification(
                'Failed to load models. Using cached data or please check your connection.', 
                'error'
            );
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
        
        // Filtering and Sorting
        get filteredModels() {
            return this.models.filter(model => 
                this.matchesSearch(model) &&
                this.matchesProviders(model) &&
                this.matchesModalities(model) &&
                this.matchesPricing(model) &&
                this.matchesContextLength(model)
            );
        },
        
        matchesSearch(model) {
            if (!this.searchQuery) return true;
            const search = this.searchQuery.toLowerCase();
            return (model.name || '').toLowerCase().includes(search) ||
                   (model.provider || '').toLowerCase().includes(search);
        },
        
        matchesProviders(model) {
            return this.selectedProviders.length === 0 || 
                   this.selectedProviders.includes(model.provider);
        },
        
        matchesModalities(model) {
            return this.selectedModalities.length === 0 || 
                   this.selectedModalities.some(modality => 
                       (model.modality || '').toLowerCase().includes(modality.toLowerCase())
                   );
        },
        
        matchesPricing(model) {
            return this.selectedPricingTypes.length === 0 || 
                   (this.selectedPricingTypes.includes('free') && this.isFreeModel(model)) || 
                   (this.selectedPricingTypes.includes('paid') && !this.isFreeModel(model));
        },
        
        matchesContextLength(model) {
            return !this.contextLengthFilter || 
                   model.contextLength >= this.contextLengthFilter;
        },
        
        get availableProviders() {
            return [...new Set(this.models.map(model => model.provider))].sort();
        },
        
        get availableModalities() {
            return [...new Set(
                this.models.flatMap(model => 
                    (model.modality || '').split('+').map(m => m.split('->')[0])
                )
            )].sort();
        },
        
        getModalityIcons(modality) {
            const icons = {
                'text': 'fas fa-comment text-blue-500',
                'image': 'fas fa-image text-green-500',
                'audio': 'fas fa-microphone text-purple-500',
                'video': 'fas fa-video text-red-500'
            };
            
            return (modality || '').split('+').map(m => {
                const type = m.split('->')[0];
                return icons[type] || 'fas fa-question-circle text-gray-500';
            });
        },
        
        formatPricing(pricing) {
            if (!pricing) {
            return `
                <div class="flex items-center space-x-1">
                    <i class="fas fa-gift text-green-500"></i>
                    <span class="text-sm font-medium">Free</span>
                </div>
            `;
            }

            const icons = {
                prompt: 'fas fa-comment',
                completion: 'fas fa-arrow-right',
                image: 'fas fa-image',
                request: 'fas fa-bolt'
            };
            
            if (this.isFreeModel(pricing)) {
                return `
                    <div class="flex items-center space-x-1">
                        <i class="fas fa-gift text-green-500"></i>
                        <span class="text-sm font-medium">Free</span>
                    </div>
                `;
            }
            
            return Object.entries(pricing)
                .filter(([_, value]) => value && value !== '0' && value !== 'free')
                .map(([type, value]) => {
                    const numericValue = parseFloat(value);
                    if (isNaN(numericValue)) return '';
                    
                    const costPerMillion = numericValue * 1000000;
                    const formattedValue = `$${costPerMillion.toFixed(2)}/M`;
                    
                    return `
                        <div class="flex items-center space-x-1">
                            <i class="${icons[type]} text-sm"></i>
                            <span class="text-sm font-medium">${formattedValue}</span>
                        </div>
                    `;
                }).join('') || 'N/A';
        },
        
        isFreeModel(model) {
            if (!model || !model.pricing) return false;
            
            return (model.name || '').toLowerCase().includes('free') || 
                   Object.values(model.pricing).some(val => val === 'free');
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
        
        setupIntersectionObserver() {
            if ('IntersectionObserver' in window) {
                const observer = new IntersectionObserver(
                    (entries) => {
                        entries.forEach(entry => {
                            if (entry.isIntersecting) {
                                entry.target.classList.add('visible');
                                observer.unobserve(entry.target);
                            }
                        });
                    },
                    { threshold: 0.1 }
                );

                setTimeout(() => {
                    document.querySelectorAll('tr').forEach(row => {
                        observer.observe(row);
                    });
                }, 1000);
            }
        },
        
        initDarkMode() {
            if (localStorage.getItem('darkMode') === 'true' || 
                (!localStorage.getItem('darkMode') && 
                 window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
            }
        }
    };
}
