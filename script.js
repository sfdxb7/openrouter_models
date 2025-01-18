function modelExplorer() {
    return {
        models: [],
        searchQuery: '',
        selectedProviders: [],
        selectedModalities: [],
        selectedPricingTypes: [],
        contextLengthFilter: null,
        statusLight: 'gray',
        sortField: 'name',
        sortDirection: 'asc',
        columns: [
            { id: 'provider', label: 'Provider', description: 'The service or organization providing the AI model' },
            { id: 'name', label: 'Model Name', description: 'Unique identifier and name of the AI model' },
            { id: 'modality', label: 'Modality', description: 'Input and output capabilities of the model (text, image, etc.)' },
            { id: 'pricing', label: 'Pricing', description: 'Cost structure for using the model (per token/request)' },
            { id: 'contextLength', label: 'Context Length', description: 'Maximum number of tokens the model can process in a single request' }
        ],

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
        },

        fetchData() {
            this.statusLight = 'yellow';
            fetch('https://openrouter.ai/api/v1/models', {
                headers: {
                    'Accept': 'application/json'
                }
            })
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.json();
            })
            .then(data => {
                if (!data?.data?.length) throw new Error('Invalid data structure from API');
                
                this.models = data.data.map(model => ({
                    id: model.id,
                    provider: model.id.split('/')[0] || 'Unknown',
                    name: model.name,
                    description: model.description || 'No description available',
                    createdAt: model.created ? new Date(model.created * 1000).toLocaleDateString() : 'Unknown',
                    modality: model.architecture?.modality || 'Unknown',
                    tokenizer: model.architecture?.tokenizer || 'Unknown',
                    limitations: model.limitations || ['No specific limitations listed'],
                    pricing: {
                        prompt: model.pricing?.prompt || '0',
                        completion: model.pricing?.completion || '0',
                        image: model.pricing?.image || '0',
                        request: model.pricing?.request || '0'
                    },
                    contextLength: Math.round((model.context_length || 0) / 1000)
                }));
                
                localStorage.setItem('openRouterModels', JSON.stringify(this.models));
                localStorage.setItem('openRouterModelsTimestamp', Date.now().toString());
                this.statusLight = 'green';
            })
            .catch(error => {
                console.error('Fetch error:', error);
                this.statusLight = 'red';
            });
        },

        get filteredModels() {
            return this.models.filter(model => {
                if (model.provider.toLowerCase() === 'openrouter') return false;

                const matchesSearch = !this.searchQuery ||
                    model.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
                    model.provider.toLowerCase().includes(this.searchQuery.toLowerCase());
                
                const matchesProvider = this.selectedProviders.length === 0 || 
                    this.selectedProviders.some(p => model.provider.toLowerCase().includes(p.toLowerCase()));
                
                const matchesModality = this.selectedModalities.length === 0 || 
                    this.selectedModalities.some(m => model.modality.toLowerCase().includes(m.toLowerCase()));
                
                const matchesPricing = this.selectedPricingTypes.length === 0 || 
                    (this.selectedPricingTypes.includes('free') && this.isFreeModel(model)) || 
                    (this.selectedPricingTypes.includes('paid') && !this.isFreeModel(model));
                
                const matchesContextLength = !this.contextLengthFilter ||
                    model.contextLength >= this.contextLengthFilter;
                
                return matchesSearch && matchesProvider && matchesModality && matchesPricing && matchesContextLength;
            });
        },

        get availableProviders() {
            return [...new Set(this.models.map(model => model.provider))].sort();
        },

        get availableModalities() {
            return [...new Set(this.models.flatMap(model => 
                model.modality.split('+').map(m => m.split('->')[0])
            ))].sort();
        },

        getProviderIcon(provider) {
            const icons = {
                'meta-llama': 'fab fa-facebook',
                'openai': 'fab fa-openai',
                'anthropic': 'fas fa-brain',
                'google': 'fab fa-google',
                'mistral': 'fas fa-wind',
                'cohere': 'fas fa-cubes'
            };
            const key = Object.keys(icons).find(k => provider.toLowerCase().includes(k));
            return key ? icons[key] : 'fas fa-robot';
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
            if (this.isFreeModel({ pricing, name: modelName })) {
                return `
                    <div class="flex items-center space-x-1">
                        <i class="fas fa-gift text-green-500"></i>
                        <span class="text-sm">Free</span>
                        <span class="free-icon">FREE</span>
                    </div>
                `;
            }

            const icons = {
                prompt: 'fas fa-comment',
                completion: 'fas fa-arrow-right',
                image: 'fas fa-image',
                request: 'fas fa-bolt'
            };

            return Object.entries(pricing)
                .filter(([_, value]) => value !== '0' && value !== 'free')
                .map(([type, value]) => {
                    const numericValue = parseFloat(value);
                    if (isNaN(numericValue)) return '';

                    const formattedValue = type === 'image'
                        ? `$${(numericValue * 1000).toFixed(2)}/K`
                        : `$${(numericValue * 1000000).toFixed(2)}/M`;

                    return `
                        <div class="flex items-center space-x-1">
                            <i class="${icons[type]} text-sm"></i>
                            <span class="text-sm">${formattedValue}</span>
                        </div>
                    `;
                }).join('') || 'N/A';
        },

        isFreeModel(model) {
            if (!model?.name || !model?.pricing) return false;
            return model.name.toLowerCase().includes('free') ||
                   model.name.toLowerCase().includes('open source') ||
                   Object.values(model.pricing).every(val => val === '0' || val === 'free');
        },

        sortBy(field) {
            if (this.sortField === field) {
                this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                this.sortField = field;
                this.sortDirection = 'asc';
            }

            const getValue = (model, field) => {
                if (field === 'pricing') {
                    if (this.isFreeModel(model)) return 0;
                    return Object.values(model.pricing).reduce((sum, val) => {
                        const num = parseFloat(val);
                        return sum + (isNaN(num) ? 0 : num);
                    }, 0);
                }
                return model[field];
            };

            this.models.sort((a, b) => {
                let valA = getValue(a, field);
                let valB = getValue(b, field);

                if (typeof valA === 'string') valA = valA.toLowerCase();
                if (typeof valB === 'string') valB = valB.toLowerCase();

                if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
                if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        },

        resetFilters() {
            this.searchQuery = '';
            this.selectedProviders = [];
            this.selectedModalities = [];
            this.selectedPricingTypes = [];
            this.contextLengthFilter = null;
        }
    };
}
