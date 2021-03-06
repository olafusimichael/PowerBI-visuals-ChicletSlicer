/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

module powerbi.extensibility.visual {
    // d3
    import Selection = d3.Selection;
    import UpdateSelection = d3.selection.Update;

    // powerbi
    import DataView = powerbi.DataView;
    import IEnumType = powerbi.IEnumType;
    import IViewport = powerbi.IViewport;
    import DataViewObjects = powerbi.DataViewObjects;
    import DataViewMetadata = powerbi.DataViewMetadata;
    import VisualDataRoleKind = powerbi.VisualDataRoleKind;
    import DataViewCategorical = powerbi.DataViewCategorical;
    import VisualObjectInstance = powerbi.VisualObjectInstance;
    import DataViewScopeIdentity = powerbi.DataViewScopeIdentity;
    import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;
    import DataViewCategoricalColumn = powerbi.DataViewCategoricalColumn;
    import VisualObjectInstancesToPersist = powerbi.VisualObjectInstancesToPersist;
    import DataViewObjectPropertyIdentifier = powerbi.DataViewObjectPropertyIdentifier;
    import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;

    // powerbi.data
    import ISQExpr = powerbi.data.ISQExpr;
    import ISemanticFilter = powerbi.data.ISemanticFilter;

    // powerbi.extensibility.utils.dataview
    import DataViewObjectsModule = powerbi.extensibility.utils.dataview.DataViewObjects;

    // powerbi.extensibility.utils.type
    import PixelConverter = powerbi.extensibility.utils.type.PixelConverter;

    // powerbi.extensibility.utils.interactivity
    import SelectableDataPoint = powerbi.extensibility.utils.interactivity.SelectableDataPoint;
    import IInteractivityService = powerbi.extensibility.utils.interactivity.IInteractivityService;
    import createInteractivityService = powerbi.extensibility.utils.interactivity.createInteractivityService;

    // powerbi.extensibility.utils.svg
    import IMargin = powerbi.extensibility.utils.svg.IMargin;
    import ClassAndSelector = powerbi.extensibility.utils.svg.CssConstants.ClassAndSelector;
    import createClassAndSelector = powerbi.extensibility.utils.svg.CssConstants.createClassAndSelector;

    // powerbi.extensibility.utils.color
    import hexToRGBString = powerbi.extensibility.utils.color.hexToRGBString;

    // powerbi.extensibility.utils.formatting
    import valueFormatter = powerbi.extensibility.utils.formatting.valueFormatter;
    import TextProperties = powerbi.extensibility.utils.formatting.TextProperties;
    import textMeasurementService = powerbi.extensibility.utils.formatting.textMeasurementService;

    module ChicletBorderStyle {
        export let ROUNDED: string = 'Rounded';
        export let CUT: string = 'Cut';
        export let SQUARE: string = 'Square';
    }

    module ChicletSlicerShowDisabled {
        export let INPLACE: string = 'Inplace';
        export let BOTTOM: string = 'Bottom';
        export let HIDE: string = 'Hide';
    }

    export module Orientation {
        export let HORIZONTAL: string = 'Horizontal';
        export let VERTICAL: string = 'Vertical';
    }

    export interface ChicletSlicerData {
        categorySourceName: string;
        formatString: string;
        slicerDataPoints: ChicletSlicerDataPoint[];
        slicerSettings: ChicletSlicerSettings;
        hasSelectionOverride?: boolean;
        hasHighlights: boolean;
        identityFields: ISQExpr[];
    }

    export interface ChicletSlicerDataPoint extends SelectableDataPoint {
        category?: string;
        value?: number;
        mouseOver?: boolean;
        mouseOut?: boolean;
        isSelectAllDataPoint?: boolean;
        imageURL?: string;
        selectable?: boolean;
        filtered?: boolean;
    }

    export interface ChicletSlicerSettings {
        general: {
            orientation: string;
            columns: number;
            rows: number;
            multiselect: boolean;
            forcedSelection: boolean;
            showDisabled: string;
            selection: string;
            selfFilterEnabled: boolean;
            getSavedSelection?: () => string[];
            setSavedSelection?: (filter: ISemanticFilter, selectionIds: string[]) => void;
            removeSavedSelection?: () => void;
        };
        margin: IMargin;
        header: {
            borderBottomWidth: number;
            show: boolean;
            outline: string;
            fontColor: string;
            background?: string;
            textSize: number;
            outlineColor: string;
            outlineWeight: number;
            title: string;
        };
        headerText: {
            marginLeft: number;
            marginTop: number;
        };
        slicerText: {
            textSize: number;
            height: number;
            width: number;
            fontColor: string;
            selectedColor: string;
            hoverColor: string;
            unselectedColor: string;
            disabledColor: string;
            marginLeft: number;
            outline: string;
            background?: string;
            transparency: number;
            outlineColor: string;
            outlineWeight: number;
            padding: number;
            borderStyle: string;
        };
        slicerItemContainer: {
            marginTop: number;
            marginLeft: number;
        };
        images: {
            imageSplit: number;
            stretchImage: boolean;
            bottomImage: boolean;
        };
    }

    export class ChicletSlicer implements IVisual {
        private $root: JQuery;
        private $searchHeader: JQuery;
        private $searchInput: JQuery;
        private currentViewport: IViewport;
        private dataView: DataView;
        private slicerHeader: Selection<any>;
        private slicerBody: Selection<any>;
        private tableView: ITableView;
        private slicerData: ChicletSlicerData;
        private settings: ChicletSlicerSettings;

        private interactivityService: IInteractivityService;
        private behavior: ChicletSlicerWebBehavior;
        private visualHost: IVisualHost;

        private waitingForData: boolean;
        private isSelectionLoaded: boolean;
        private isSelectionSaved: boolean;

        public static DefaultFontFamily: string = "helvetica, arial, sans-serif";
        public static DefaultFontSizeInPt: number = 11;

        private static СellTotalInnerPaddings: number = 8;
        private static СellTotalInnerBorders: number = 2;
        private static СhicletTotalInnerRightLeftPaddings: number = 14;

        public static MinImageSplit: number = 0;
        public static MinImageSplitToHide: number = 10;
        public static MaxImageSplit: number = 100;
        public static MaxImageSplitToHide: number = 90;
        public static MaxImageWidth: number = 100;

        public static MaxTransparency: number = 100;

        private static MaxCellPadding: number = 20;

        private static MinSizeOfViewport: number = 0;
        private static MinColumns: number = 1;

        private static WidthOfScrollbar: number = 17;

        public static ItemContainerSelector: ClassAndSelector = createClassAndSelector('slicerItemContainer');
        public static SlicerImgWrapperSelector: ClassAndSelector = createClassAndSelector('slicer-img-wrapper');
        public static SlicerTextWrapperSelector: ClassAndSelector = createClassAndSelector('slicer-text-wrapper');
        public static SlicerBodyHorizontalSelector: ClassAndSelector = createClassAndSelector('slicerBody-horizontal');
        public static SlicerBodyVerticalSelector: ClassAndSelector = createClassAndSelector('slicerBody-vertical');
        public static HeaderTextSelector: ClassAndSelector = createClassAndSelector('headerText');
        public static ContainerSelector: ClassAndSelector = createClassAndSelector('chicletSlicer');
        public static LabelTextSelector: ClassAndSelector = createClassAndSelector('slicerText');
        public static HeaderSelector: ClassAndSelector = createClassAndSelector('slicerHeader');
        public static InputSelector: ClassAndSelector = createClassAndSelector('slicerCheckbox');
        public static ClearSelector: ClassAndSelector = createClassAndSelector('clear');
        public static SearchSelector: ClassAndSelector = createClassAndSelector('searchToggle');
        public static BodySelector: ClassAndSelector = createClassAndSelector('slicerBody');

        public static DefaultStyleProperties(): ChicletSlicerSettings {
            return {
                general: {
                    orientation: Orientation.VERTICAL,
                    columns: 3,
                    rows: 0,
                    multiselect: true,
                    forcedSelection: false,
                    showDisabled: ChicletSlicerShowDisabled.INPLACE,
                    selection: null,
                    selfFilterEnabled: false
                },
                margin: {
                    top: 50,
                    bottom: 50,
                    right: 50,
                    left: 50
                },
                header: {
                    borderBottomWidth: 1,
                    show: true,
                    outline: 'BottomOnly',
                    fontColor: '#a6a6a6',
                    background: null,
                    textSize: 10,
                    outlineColor: '#a6a6a6',
                    outlineWeight: 1,
                    title: '',
                },
                headerText: {
                    marginLeft: 8,
                    marginTop: 0
                },
                slicerText: {
                    textSize: 10,
                    height: 0,
                    width: 0,
                    fontColor: '#666666',
                    hoverColor: '#212121',
                    selectedColor: '#BDD7EE',
                    unselectedColor: '#ffffff',
                    disabledColor: 'grey',
                    marginLeft: 8,
                    outline: 'Frame',
                    background: null,
                    transparency: 0,
                    outlineColor: '#000000',
                    outlineWeight: 1,
                    padding: 3,
                    borderStyle: 'Cut',

                },
                slicerItemContainer: {
                    // The margin is assigned in the less file. This is needed for the height calculations.
                    marginTop: 5,
                    marginLeft: 0,
                },
                images: {
                    imageSplit: 50,
                    stretchImage: false,
                    bottomImage: false
                }
            };
        }

        /**
         * Public to testability.
         */
        public static getValidImageSplit(imageSplit): number {
            if (imageSplit < ChicletSlicer.MinImageSplit) {
                return ChicletSlicer.MinImageSplit;
            } else if (imageSplit > ChicletSlicer.MaxImageSplit) {
                return ChicletSlicer.MaxImageSplit;
            } else {
                return imageSplit;
            }
        }

        public static converter(
            dataView: DataView,
            searchText: string,
            visualHost: IVisualHost): ChicletSlicerData {

            if (!dataView ||
                !dataView.categorical ||
                !dataView.categorical.categories ||
                !dataView.categorical.categories[0] ||
                !dataView.categorical.categories[0].values ||
                !(dataView.categorical.categories[0].values.length > 0)) {
                return;
            }

            let converter: ChicletSlicerConverter = new ChicletSlicerConverter(dataView, visualHost);
            converter.convert();

            let slicerData: ChicletSlicerData,
                defaultSettings: ChicletSlicerSettings = this.DefaultStyleProperties(),
                objects: DataViewObjects = dataView.metadata.objects;

            if (objects) {
                defaultSettings.general.orientation = DataViewObjectsModule.getValue<string>(objects, chicletSlicerProps.general.orientation, defaultSettings.general.orientation);
                defaultSettings.general.columns = DataViewObjectsModule.getValue<number>(objects, chicletSlicerProps.general.columns, defaultSettings.general.columns);
                defaultSettings.general.rows = DataViewObjectsModule.getValue<number>(objects, chicletSlicerProps.general.rows, defaultSettings.general.rows);
                defaultSettings.general.multiselect = DataViewObjectsModule.getValue<boolean>(objects, chicletSlicerProps.general.multiselect, defaultSettings.general.multiselect);
                defaultSettings.general.forcedSelection = DataViewObjectsModule.getValue<boolean>(objects, chicletSlicerProps.general.forcedSelection, defaultSettings.general.forcedSelection);
                defaultSettings.general.showDisabled = DataViewObjectsModule.getValue<string>(objects, chicletSlicerProps.general.showDisabled, defaultSettings.general.showDisabled);
                defaultSettings.general.selection = DataViewObjectsModule.getValue(dataView.metadata.objects, chicletSlicerProps.general.selection, defaultSettings.general.selection);
                defaultSettings.general.selfFilterEnabled = DataViewObjectsModule.getValue<boolean>(objects, chicletSlicerProps.general.selfFilterEnabled, defaultSettings.general.selfFilterEnabled);

                defaultSettings.header.show = DataViewObjectsModule.getValue<boolean>(objects, chicletSlicerProps.header.show, defaultSettings.header.show);
                defaultSettings.header.title = DataViewObjectsModule.getValue<string>(objects, chicletSlicerProps.header.title, defaultSettings.header.title);
                defaultSettings.header.fontColor = DataViewObjectsModule.getFillColor(objects, chicletSlicerProps.header.fontColor, defaultSettings.header.fontColor);
                defaultSettings.header.background = DataViewObjectsModule.getFillColor(objects, chicletSlicerProps.header.background, defaultSettings.header.background);
                defaultSettings.header.textSize = DataViewObjectsModule.getValue<number>(objects, chicletSlicerProps.header.textSize, defaultSettings.header.textSize);
                defaultSettings.header.outline = DataViewObjectsModule.getValue<string>(objects, chicletSlicerProps.header.outline, defaultSettings.header.outline);
                defaultSettings.header.outlineColor = DataViewObjectsModule.getFillColor(objects, chicletSlicerProps.header.outlineColor, defaultSettings.header.outlineColor);
                defaultSettings.header.outlineWeight = DataViewObjectsModule.getValue<number>(objects, chicletSlicerProps.header.outlineWeight, defaultSettings.header.outlineWeight);

                defaultSettings.slicerText.textSize = DataViewObjectsModule.getValue<number>(objects, chicletSlicerProps.rows.textSize, defaultSettings.slicerText.textSize);
                defaultSettings.slicerText.height = DataViewObjectsModule.getValue<number>(objects, chicletSlicerProps.rows.height, defaultSettings.slicerText.height);
                defaultSettings.slicerText.width = DataViewObjectsModule.getValue<number>(objects, chicletSlicerProps.rows.width, defaultSettings.slicerText.width);
                defaultSettings.slicerText.selectedColor = DataViewObjectsModule.getFillColor(objects, chicletSlicerProps.rows.selectedColor, defaultSettings.slicerText.selectedColor);
                defaultSettings.slicerText.hoverColor = DataViewObjectsModule.getFillColor(objects, chicletSlicerProps.rows.hoverColor, defaultSettings.slicerText.hoverColor);
                defaultSettings.slicerText.unselectedColor = DataViewObjectsModule.getFillColor(objects, chicletSlicerProps.rows.unselectedColor, defaultSettings.slicerText.unselectedColor);
                defaultSettings.slicerText.disabledColor = DataViewObjectsModule.getFillColor(objects, chicletSlicerProps.rows.disabledColor, defaultSettings.slicerText.disabledColor);
                defaultSettings.slicerText.background = DataViewObjectsModule.getFillColor(objects, chicletSlicerProps.rows.background, defaultSettings.slicerText.background);
                defaultSettings.slicerText.transparency = DataViewObjectsModule.getValue<number>(objects, chicletSlicerProps.rows.transparency, defaultSettings.slicerText.transparency);
                defaultSettings.slicerText.fontColor = DataViewObjectsModule.getFillColor(objects, chicletSlicerProps.rows.fontColor, defaultSettings.slicerText.fontColor);
                defaultSettings.slicerText.outline = DataViewObjectsModule.getValue<string>(objects, chicletSlicerProps.rows.outline, defaultSettings.slicerText.outline);
                defaultSettings.slicerText.outlineColor = DataViewObjectsModule.getFillColor(objects, chicletSlicerProps.rows.outlineColor, defaultSettings.slicerText.outlineColor);
                defaultSettings.slicerText.outlineWeight = DataViewObjectsModule.getValue<number>(objects, chicletSlicerProps.rows.outlineWeight, defaultSettings.slicerText.outlineWeight);
                defaultSettings.slicerText.padding = DataViewObjectsModule.getValue<number>(objects, chicletSlicerProps.rows.padding, defaultSettings.slicerText.padding);
                defaultSettings.slicerText.borderStyle = DataViewObjectsModule.getValue<string>(objects, chicletSlicerProps.rows.borderStyle, defaultSettings.slicerText.borderStyle);

                defaultSettings.images.imageSplit = DataViewObjectsModule.getValue<number>(objects, chicletSlicerProps.images.imageSplit, defaultSettings.images.imageSplit);
                defaultSettings.images.stretchImage = DataViewObjectsModule.getValue<boolean>(objects, chicletSlicerProps.images.stretchImage, defaultSettings.images.stretchImage);
                defaultSettings.images.bottomImage = DataViewObjectsModule.getValue<boolean>(objects, chicletSlicerProps.images.bottomImage, defaultSettings.images.bottomImage);
            }

            if (defaultSettings.general.selfFilterEnabled && searchText) {
                searchText = searchText.toLowerCase();
                converter.dataPoints.forEach(x => x.filtered = x.category.toLowerCase().indexOf(searchText) < 0);
            }

            let categories: DataViewCategoricalColumn = dataView.categorical.categories[0];

            slicerData = {
                categorySourceName: categories.source.displayName,
                formatString: valueFormatter.getFormatStringByColumn(categories.source),
                slicerSettings: defaultSettings,
                slicerDataPoints: converter.dataPoints,
                identityFields: converter.identityFields,
                hasHighlights: converter.hasHighlights
            };

            // Override hasSelection if a objects contained more scopeIds than selections we found in the data
            slicerData.hasSelectionOverride = converter.hasSelectionOverride;

            return slicerData;
        }


        constructor(options: VisualConstructorOptions) {
            this.$root = $(options.element);

            this.visualHost = options.host;

            this.behavior = new ChicletSlicerWebBehavior();
            this.interactivityService = createInteractivityService(options.host);

            this.settings = ChicletSlicer.DefaultStyleProperties();
        }

        public update(options: VisualUpdateOptions) {
            if (!options ||
                !options.dataViews ||
                !options.dataViews[0] ||
                !options.viewport) {
                return;
            }

            if (!this.currentViewport) {
                this.currentViewport = options.viewport;
                this.initContainer();
            }

            const existingDataView = this.dataView;
            this.dataView = options.dataViews[0];

            let resetScrollbarPosition: boolean = true;

            if (existingDataView) {
                resetScrollbarPosition = !ChicletSlicer.hasSameCategoryIdentity(existingDataView, this.dataView);
            }

            if (options.viewport.height === this.currentViewport.height
                && options.viewport.width === this.currentViewport.width) {
                this.waitingForData = false;
            }
            else {
                this.currentViewport = options.viewport;
            }

            this.updateInternal(resetScrollbarPosition);
        }

        private static hasSameCategoryIdentity(dataView1: DataView, dataView2: DataView): boolean {
            if (!dataView1 ||
                !dataView2 ||
                !dataView1.categorical ||
                !dataView2.categorical) {
                return false;
            }

            let dv1Categories: DataViewCategoricalColumn[] = dataView1.categorical.categories;
            let dv2Categories: DataViewCategoricalColumn[] = dataView2.categorical.categories;

            if (!dv1Categories ||
                !dv2Categories ||
                dv1Categories.length !== dv2Categories.length) {
                return false;
            }

            for (let i: number = 0, len: number = dv1Categories.length; i < len; i++) {
                let dv1Identity: DataViewScopeIdentity[] = (<DataViewCategoryColumn>dv1Categories[i]).identity;
                let dv2Identity: DataViewScopeIdentity[] = (<DataViewCategoryColumn>dv2Categories[i]).identity;

                let dv1Length: number = this.getLengthOptional(dv1Identity);
                if ((dv1Length < 1) || dv1Length !== this.getLengthOptional(dv2Identity)) {
                    return false;
                }

                for (let j: number = 0; j < dv1Length; j++) {
                    if (!_.isEqual(dv1Identity[j].key, dv2Identity[j].key)) {
                        return false;
                    }
                }
            }

            return true;
        }

        private static getLengthOptional(identity: DataViewScopeIdentity[]): number {
            if (identity) {
                return identity.length;
            }
            return 0;
        }

        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
            let data: ChicletSlicerData = this.slicerData;

            if (!data) {
                return [];
            }

            switch (options.objectName) {
                case 'rows':
                    return this.enumerateRows(data);
                case 'header':
                    return this.enumerateHeader(data);
                case 'general':
                    return this.enumerateGeneral(data);
                case 'images':
                    return this.enumerateImages(data);
                default:
                    return [];
            }
        }

        private enumerateHeader(data: ChicletSlicerData): VisualObjectInstance[] {
            let slicerSettings: ChicletSlicerSettings = this.settings;

            return [{
                selector: null,
                objectName: 'header',
                properties: {
                    show: slicerSettings.header.show,
                    title: slicerSettings.header.title,
                    fontColor: slicerSettings.header.fontColor,
                    background: slicerSettings.header.background,
                    textSize: slicerSettings.header.textSize,
                    outline: slicerSettings.header.outline,
                    outlineColor: slicerSettings.header.outlineColor,
                    outlineWeight: slicerSettings.header.outlineWeight
                }
            }];
        }

        private enumerateRows(data: ChicletSlicerData): VisualObjectInstance[] {
            let slicerSettings: ChicletSlicerSettings = this.settings;

            return [{
                selector: null,
                objectName: 'rows',
                properties: {
                    textSize: slicerSettings.slicerText.textSize,
                    height: slicerSettings.slicerText.height,
                    width: slicerSettings.slicerText.width,
                    background: slicerSettings.slicerText.background,
                    transparency: slicerSettings.slicerText.transparency,
                    selectedColor: slicerSettings.slicerText.selectedColor,
                    hoverColor: slicerSettings.slicerText.hoverColor,
                    unselectedColor: slicerSettings.slicerText.unselectedColor,
                    disabledColor: slicerSettings.slicerText.disabledColor,
                    outline: slicerSettings.slicerText.outline,
                    outlineColor: slicerSettings.slicerText.outlineColor,
                    outlineWeight: slicerSettings.slicerText.outlineWeight,
                    fontColor: slicerSettings.slicerText.fontColor,
                    padding: slicerSettings.slicerText.padding,
                    borderStyle: slicerSettings.slicerText.borderStyle,
                }
            }];
        }

        private enumerateGeneral(data: ChicletSlicerData): VisualObjectInstance[] {
            let slicerSettings: ChicletSlicerSettings = this.settings;

            return [{
                selector: null,
                objectName: 'general',
                properties: {
                    orientation: slicerSettings.general.orientation,
                    columns: slicerSettings.general.columns,
                    rows: slicerSettings.general.rows,
                    showDisabled: slicerSettings.general.showDisabled,
                    multiselect: slicerSettings.general.multiselect,
                    forcedSelection: slicerSettings.general.forcedSelection,
                    selfFilterEnabled: slicerSettings.general.selfFilterEnabled
                }
            }];
        }

        private enumerateImages(data: ChicletSlicerData): VisualObjectInstance[] {
            let slicerSettings: ChicletSlicerSettings = this.settings;

            return [{
                selector: null,
                objectName: 'images',
                properties: {
                    imageSplit: slicerSettings.images.imageSplit,
                    stretchImage: slicerSettings.images.stretchImage,
                    bottomImage: slicerSettings.images.bottomImage,
                }
            }];
        }

        private updateInternal(resetScrollbarPosition: boolean) {
            let data = ChicletSlicer.converter(
                this.dataView,
                this.$searchInput.val(),
                this.visualHost);

            if (!data) {
                this.tableView.empty();

                return;
            }

            data.slicerSettings.header.outlineWeight = data.slicerSettings.header.outlineWeight < 0
                ? 0
                : data.slicerSettings.header.outlineWeight;

            data.slicerSettings.slicerText.outlineWeight = data.slicerSettings.slicerText.outlineWeight < 0
                ? 0
                : data.slicerSettings.slicerText.outlineWeight;

            data.slicerSettings.slicerText.padding = data.slicerSettings.slicerText.padding < 0
                ? 0
                : data.slicerSettings.slicerText.padding;

            data.slicerSettings.slicerText.height = data.slicerSettings.slicerText.height < 0
                ? 0
                : data.slicerSettings.slicerText.height;

            data.slicerSettings.slicerText.width = data.slicerSettings.slicerText.width < 0
                ? 0
                : data.slicerSettings.slicerText.width;

            data.slicerSettings.images.imageSplit = ChicletSlicer.getValidImageSplit(data.slicerSettings.images.imageSplit);

            data.slicerSettings.general.columns = data.slicerSettings.general.columns < 0
                ? 0
                : data.slicerSettings.general.columns;

            data.slicerSettings.general.rows = data.slicerSettings.general.rows < 0
                ? 0
                : data.slicerSettings.general.rows;

            data.slicerSettings.general.getSavedSelection = () => {
                try {
                    return JSON.parse(this.slicerData.slicerSettings.general.selection) || [];
                } catch (ex) {
                    return [];
                }
            };

            data.slicerSettings.general.setSavedSelection = (filter: ISemanticFilter, selectionIds: string[]): void => {
                this.isSelectionSaved = true;
                this.visualHost.persistProperties(<VisualObjectInstancesToPersist>{
                    merge: [{
                        objectName: "general",
                        selector: null,
                        properties: {
                            filter: filter || null,
                            selection: selectionIds && JSON.stringify(selectionIds) || ""
                        }
                    }]
                });
            };

            data.slicerSettings.general.removeSavedSelection = (): void => {
                this.isSelectionSaved = true;
                this.visualHost.persistProperties(<VisualObjectInstancesToPersist>{
                    merge: [{
                        objectName: "general",
                        selector: null,
                        properties: {
                            filter: null,
                            selection: ""
                        }
                    }]
                });
            };

            if (this.slicerData) {
                if (this.isSelectionSaved) {
                    this.isSelectionLoaded = true;
                } else {
                    this.isSelectionLoaded = this.slicerData.slicerSettings.general.selection === data.slicerSettings.general.selection;
                }
            } else {
                this.isSelectionLoaded = false;
            }

            this.slicerData = data;
            this.settings = this.slicerData.slicerSettings;

            this.updateSlicerBodyDimensions();

            if (this.settings.general.showDisabled === ChicletSlicerShowDisabled.BOTTOM) {
                data.slicerDataPoints.sort(function (a, b) {
                    if (a.selectable === b.selectable) {
                        return 0;
                    } else if (a.selectable && !b.selectable) {
                        return -1;
                    } else {
                        return 1;
                    }
                });
            } else if (this.settings.general.showDisabled === ChicletSlicerShowDisabled.HIDE) {
                data.slicerDataPoints = data.slicerDataPoints.filter(x => x.selectable);
            }

            let height: number = this.settings.slicerText.height;

            if (height === ChicletSlicer.MinImageSplit) {
                let extraSpaceForCell = ChicletSlicer.СellTotalInnerPaddings + ChicletSlicer.СellTotalInnerBorders,
                    textProperties: TextProperties = ChicletSlicer.getChicletTextProperties(this.settings.slicerText.textSize);

                height = textMeasurementService.estimateSvgTextHeight(textProperties) +
                    textMeasurementService.estimateSvgTextBaselineDelta(textProperties) +
                    extraSpaceForCell;

                let hasImage: boolean = _.some(data.slicerDataPoints, (dataPoint: ChicletSlicerDataPoint) => {
                    return dataPoint.imageURL !== '' && typeof dataPoint.imageURL !== "undefined";
                });

                if (hasImage) {
                    height += ChicletSlicer.MaxImageSplit;
                }
            }

            this.tableView
                .rowHeight(height)
                .columnWidth(this.settings.slicerText.width)
                .orientation(this.settings.general.orientation)
                .rows(this.settings.general.rows)
                .columns(this.settings.general.columns)
                .data(
                data.slicerDataPoints.filter(x => !x.filtered),
                (d: ChicletSlicerDataPoint) => $.inArray(d, data.slicerDataPoints),
                resetScrollbarPosition)
                .viewport(this.getSlicerBodyViewport(this.currentViewport))
                .render();

            this.updateSearchHeader();
        }

        private initContainer() {
            let settings: ChicletSlicerSettings = this.settings,
                slicerBodyViewport: IViewport = this.getSlicerBodyViewport(this.currentViewport);

            let slicerContainer: Selection<any> = d3.select(this.$root.get(0))
                .append('div')
                .classed(ChicletSlicer.ContainerSelector.class, true);

            this.slicerHeader = slicerContainer
                .append('div')
                .classed(ChicletSlicer.HeaderSelector.class, true);

            this.slicerHeader
                .append('span')
                .classed(ChicletSlicer.ClearSelector.class, true)
                .attr('title', 'Clear');

            this.slicerHeader
                .append('span')
                .classed(ChicletSlicer.SearchSelector.class, true)
                .attr('title', 'Search')
                .on('click', () => this.toggleSearch());

            this.slicerHeader
                .append('div')
                .classed(ChicletSlicer.HeaderTextSelector.class, true)
                .style({
                    'margin-left': PixelConverter.toString(settings.headerText.marginLeft),
                    'margin-top': PixelConverter.toString(settings.headerText.marginTop),
                    'border-style': this.getBorderStyle(settings.header.outline),
                    'border-color': settings.header.outlineColor,
                    'border-width': this.getBorderWidth(settings.header.outline, settings.header.outlineWeight),
                    'font-size': PixelConverter.fromPoint(settings.header.textSize),
                });

            this.createSearchHeader($(slicerContainer.node()));

            this.slicerBody = slicerContainer
                .append('div')
                .classed(ChicletSlicer.BodySelector.class, true)
                .classed(
                ChicletSlicer.SlicerBodyHorizontalSelector.class,
                settings.general.orientation === Orientation.HORIZONTAL)
                .classed(
                ChicletSlicer.SlicerBodyVerticalSelector.class,
                settings.general.orientation === Orientation.VERTICAL
                )
                .style({
                    'height': PixelConverter.toString(slicerBodyViewport.height),
                    'width': `${ChicletSlicer.MaxImageWidth}%`,
                });

            let rowEnter = (rowSelection: Selection<any>) => {
                this.enterSelection(rowSelection);
            };

            let rowUpdate = (rowSelection: Selection<any>) => {
                this.updateSelection(rowSelection);
            };

            let rowExit = (rowSelection: Selection<any>) => {
                rowSelection.remove();
            };

            let tableViewOptions: TableViewViewOptions = {
                rowHeight: this.getRowHeight(),
                columnWidth: this.settings.slicerText.width,
                orientation: this.settings.general.orientation,
                rows: this.settings.general.rows,
                columns: this.settings.general.columns,
                enter: rowEnter,
                exit: rowExit,
                update: rowUpdate,
                scrollEnabled: true,
                viewport: this.getSlicerBodyViewport(this.currentViewport),
                baseContainer: this.slicerBody,
            };

            this.tableView = TableViewFactory.createTableView(tableViewOptions);
        }

        private toggleSearch(): void {
            if (!this.slicerData ||
                !this.slicerData.slicerSettings ||
                !this.slicerData.slicerSettings.general) {
                return;
            }
            this.visualHost.persistProperties(<VisualObjectInstancesToPersist>{
                merge: [{
                    objectName: "general",
                    selector: null,
                    properties: {
                        selfFilterEnabled: !this.slicerData.slicerSettings.general.selfFilterEnabled
                    }
                }]
            });
        }

        private enterSelection(rowSelection: Selection<any>): void {
            let settings: ChicletSlicerSettings = this.settings;

            let ulItemElement: UpdateSelection<any> = rowSelection
                .selectAll('ul')
                .data((dataPoint: ChicletSlicerDataPoint) => {
                    return [dataPoint];
                });

            ulItemElement
                .enter()
                .append('ul');

            ulItemElement
                .exit()
                .remove();

            let listItemElement: UpdateSelection<any> = ulItemElement
                .selectAll(ChicletSlicer.ItemContainerSelector.selector)
                .data((dataPoint: ChicletSlicerDataPoint) => {
                    return [dataPoint];
                });

            listItemElement
                .enter()
                .append('li')
                .classed(ChicletSlicer.ItemContainerSelector.class, true);

            listItemElement.style({
                'margin-left': PixelConverter.toString(settings.slicerItemContainer.marginLeft)
            });

            let slicerImgWrapperSelection: UpdateSelection<any> = listItemElement
                .selectAll(ChicletSlicer.SlicerImgWrapperSelector.selector)
                .data((dataPoint: ChicletSlicerDataPoint) => {
                    return [dataPoint];
                });

            slicerImgWrapperSelection
                .enter()
                .append('img')
                .classed(ChicletSlicer.SlicerImgWrapperSelector.class, true);

            slicerImgWrapperSelection
                .exit()
                .remove();

            let slicerTextWrapperSelection: UpdateSelection<any> = listItemElement
                .selectAll(ChicletSlicer.SlicerTextWrapperSelector.selector)
                .data((dataPoint: ChicletSlicerDataPoint) => {
                    return [dataPoint];
                });

            slicerTextWrapperSelection
                .enter()
                .append('div')
                .classed(ChicletSlicer.SlicerTextWrapperSelector.class, true);

            let labelTextSelection: UpdateSelection<any> = slicerTextWrapperSelection
                .selectAll(ChicletSlicer.LabelTextSelector.selector)
                .data((dataPoint: ChicletSlicerDataPoint) => {
                    return [dataPoint];
                });

            labelTextSelection
                .enter()
                .append('span')
                .classed(ChicletSlicer.LabelTextSelector.class, true);

            labelTextSelection.style({
                'font-size': PixelConverter.fromPoint(settings.slicerText.textSize),
            });

            labelTextSelection
                .exit()
                .remove();

            slicerTextWrapperSelection
                .exit()
                .remove();

            listItemElement
                .exit()
                .remove();
        };

        private updateSelection(rowSelection: Selection<any>): void {
            let settings: ChicletSlicerSettings = this.settings,
                data: ChicletSlicerData = this.slicerData;

            if (data && settings) {
                this.slicerHeader
                    .classed('hidden', !settings.header.show);

                this.slicerHeader
                    .select(ChicletSlicer.HeaderTextSelector.selector)
                    .text(settings.header.title.trim() !== ""
                        ? settings.header.title.trim()
                        : this.slicerData.categorySourceName)
                    .style({
                        'border-style': this.getBorderStyle(settings.header.outline),
                        'border-color': settings.header.outlineColor,
                        'border-width': this.getBorderWidth(settings.header.outline, settings.header.outlineWeight),
                        'color': settings.header.fontColor,
                        'background-color': settings.header.background,
                        'font-size': PixelConverter.fromPoint(settings.header.textSize),
                    });

                this.slicerBody
                    .classed(
                    ChicletSlicer.SlicerBodyHorizontalSelector.class,
                    settings.general.orientation === Orientation.HORIZONTAL)
                    .classed(
                    ChicletSlicer.SlicerBodyVerticalSelector.class,
                    settings.general.orientation === Orientation.VERTICAL);

                let slicerText: Selection<any> = rowSelection.selectAll(ChicletSlicer.LabelTextSelector.selector),
                    textProperties: TextProperties = ChicletSlicer.getChicletTextProperties(settings.slicerText.textSize),
                    formatString: string = data.formatString;

                slicerText.text((d: ChicletSlicerDataPoint) => {
                    let maxWidth: number = 0;

                    textProperties.text = valueFormatter.format(d.category, formatString);

                    if (this.settings.slicerText.width === 0) {
                        let slicerBodyViewport: IViewport = this.getSlicerBodyViewport(this.currentViewport);

                        maxWidth = (slicerBodyViewport.width / (this.tableView.computedColumns || ChicletSlicer.MinColumns)) -
                            ChicletSlicer.СhicletTotalInnerRightLeftPaddings -
                            ChicletSlicer.СellTotalInnerBorders -
                            settings.slicerText.outlineWeight;

                        return textMeasurementService.getTailoredTextOrDefault(textProperties, maxWidth);
                    }
                    else {
                        maxWidth = this.settings.slicerText.width -
                            ChicletSlicer.СhicletTotalInnerRightLeftPaddings -
                            ChicletSlicer.СellTotalInnerBorders -
                            settings.slicerText.outlineWeight;

                        return textMeasurementService.getTailoredTextOrDefault(textProperties, maxWidth);
                    }
                });

                rowSelection
                    .style({
                        'padding': PixelConverter.toString(settings.slicerText.padding)
                    });

                rowSelection
                    .selectAll(ChicletSlicer.SlicerImgWrapperSelector.selector)
                    .style({
                        'max-height': settings.images.imageSplit + '%',
                        'display': (dataPoint: ChicletSlicerDataPoint) => (dataPoint.imageURL)
                            ? 'flex'
                            : 'none'
                    })
                    .classed({
                        'hidden': (dataPoint: ChicletSlicerDataPoint) => {
                            if (!(dataPoint.imageURL)) {
                                return true;
                            }

                            if (settings.images.imageSplit < ChicletSlicer.MinImageSplitToHide) {
                                return true;
                            }
                        },
                        'stretchImage': settings.images.stretchImage,
                        'bottomImage': settings.images.bottomImage
                    })
                    .attr('src', (d: ChicletSlicerDataPoint) => {
                        return d.imageURL ? d.imageURL : '';
                    });

                rowSelection.selectAll(ChicletSlicer.SlicerTextWrapperSelector.selector)
                    .style('height', (d: ChicletSlicerDataPoint): string => {
                        let height: number = ChicletSlicer.MaxImageSplit;
                        if (d.imageURL) {
                            height -= settings.images.imageSplit;
                        }
                        return `${height}%`;
                    })
                    .classed('hidden', (d: ChicletSlicerDataPoint) => {
                        if (settings.images.imageSplit > ChicletSlicer.MaxImageSplitToHide) {
                            return true;
                        }
                    });

                rowSelection.selectAll(ChicletSlicer.ItemContainerSelector.selector).style({
                    'color': settings.slicerText.fontColor,
                    'border-style': this.getBorderStyle(settings.slicerText.outline),
                    'border-color': settings.slicerText.outlineColor,
                    'border-width': this.getBorderWidth(settings.slicerText.outline, settings.slicerText.outlineWeight),
                    'font-size': PixelConverter.fromPoint(settings.slicerText.textSize),
                    'border-radius': this.getBorderRadius(settings.slicerText.borderStyle),
                });

                if (settings.slicerText.background) {
                    let backgroundColor: string = hexToRGBString(
                        settings.slicerText.background,
                        (ChicletSlicer.MaxTransparency - settings.slicerText.transparency) / ChicletSlicer.MaxTransparency);

                    this.slicerBody.style('background-color', backgroundColor);
                }
                else {
                    this.slicerBody.style('background-color', null);
                }

                if (this.interactivityService && this.slicerBody) {

                    if (data.hasHighlights) {
                        this.interactivityService.clearSelection();
                        this.slicerData.slicerSettings.general.removeSavedSelection();
                    } else {
                        this.interactivityService.applySelectionStateToData(data.slicerDataPoints);
                    }

                    let slicerBody: Selection<any> = this.slicerBody.attr('width', this.currentViewport.width),
                        slicerItemContainers: Selection<any> = slicerBody.selectAll(ChicletSlicer.ItemContainerSelector.selector),
                        slicerItemLabels: Selection<any> = slicerBody.selectAll(ChicletSlicer.LabelTextSelector.selector),
                        slicerItemInputs: Selection<any> = slicerBody.selectAll(ChicletSlicer.InputSelector.selector),
                        slicerClear: Selection<any> = this.slicerHeader.select(ChicletSlicer.ClearSelector.selector);

                    let behaviorOptions: ChicletSlicerBehaviorOptions = {
                        dataPoints: data.slicerDataPoints,
                        slicerItemContainers: slicerItemContainers,
                        slicerItemLabels: slicerItemLabels,
                        slicerItemInputs: slicerItemInputs,
                        slicerClear: slicerClear,
                        interactivityService: this.interactivityService,
                        slicerSettings: data.slicerSettings,
                        isSelectionLoaded: this.isSelectionLoaded || data.hasHighlights,
                        identityFields: data.identityFields
                    };
                    this.interactivityService.bind(data.slicerDataPoints, this.behavior, behaviorOptions, {
                        overrideSelectionFromData: true,
                        hasSelectionOverride: data.hasSelectionOverride,
                    });

                    this.behavior.styleSlicerInputs(
                        rowSelection.select(ChicletSlicer.ItemContainerSelector.selector),
                        this.interactivityService.hasSelection());
                }
                else {
                    this.behavior.styleSlicerInputs(rowSelection.select(ChicletSlicer.ItemContainerSelector.selector), false);
                }
            }
        };

        private createSearchHeader(container: JQuery): void {
            let counter: number = 0;

            this.$searchHeader = $("<div>")
                .appendTo(container)
                .addClass("searchHeader")
                .addClass("collapsed");

            $("<div>").appendTo(this.$searchHeader)
                .attr("title", "Search")
                .addClass("search");

            this.$searchInput = $("<input>").appendTo(this.$searchHeader)
                .attr("type", "text")
                .attr("drag-resize-disabled", "true")
                .addClass("searchInput")
                .on("input", () => this.visualHost.persistProperties(<VisualObjectInstancesToPersist>{
                    merge: [{
                        objectName: "general",
                        selector: null,
                        properties: {
                            counter: counter++
                        }
                    }]
                }));
        }

        private updateSearchHeader(): void {
            this.$searchHeader.toggleClass("show", this.slicerData.slicerSettings.general.selfFilterEnabled);
            this.$searchHeader.toggleClass("collapsed", !this.slicerData.slicerSettings.general.selfFilterEnabled);
        }

        private getSlicerBodyViewport(currentViewport: IViewport): IViewport {
            let settings: ChicletSlicerSettings = this.settings,
                headerHeight: number = (settings.header.show) ? this.getHeaderHeight() : 0,
                borderHeight: number = settings.header.outlineWeight,
                height: number = currentViewport.height - (headerHeight + borderHeight + settings.header.borderBottomWidth),
                width: number = currentViewport.width - ChicletSlicer.WidthOfScrollbar;

            return {
                height: Math.max(height, ChicletSlicer.MinSizeOfViewport),
                width: Math.max(width, ChicletSlicer.MinSizeOfViewport)
            };
        }

        private updateSlicerBodyDimensions(): void {
            let slicerViewport: IViewport = this.getSlicerBodyViewport(this.currentViewport);
            this.slicerBody
                .style({
                    'height': PixelConverter.toString(slicerViewport.height),
                    'width': `${ChicletSlicer.MaxImageWidth}%`,
                });
        }

        public static getChicletTextProperties(textSize?: number): TextProperties {
            return <TextProperties>{
                fontFamily: ChicletSlicer.DefaultFontFamily,
                fontSize: PixelConverter.fromPoint(textSize || ChicletSlicer.DefaultFontSizeInPt),
            };
        }

        private getHeaderHeight(): number {
            return textMeasurementService.estimateSvgTextHeight(
                ChicletSlicer.getChicletTextProperties(this.settings.header.textSize));
        }

        private getRowHeight(): number {
            let textSettings = this.settings.slicerText;
            return textSettings.height !== 0
                ? textSettings.height
                : textMeasurementService.estimateSvgTextHeight(ChicletSlicer.getChicletTextProperties(textSettings.textSize));
        }

        private getBorderStyle(outlineElement: string): string {
            return outlineElement === '0px' ? 'none' : 'solid';
        }

        private getBorderWidth(outlineElement: string, outlineWeight: number): string {
            switch (outlineElement) {
                case 'None':
                    return '0px';
                case 'BottomOnly':
                    return '0px 0px ' + outlineWeight + 'px 0px';
                case 'TopOnly':
                    return outlineWeight + 'px 0px 0px 0px';
                case 'TopBottom':
                    return outlineWeight + 'px 0px ' + outlineWeight + 'px 0px';
                case 'LeftRight':
                    return '0px ' + outlineWeight + 'px 0px ' + outlineWeight + 'px';
                case 'Frame':
                    return outlineWeight + 'px';
                default:
                    return outlineElement.replace("1", outlineWeight.toString());
            }
        }

        private getBorderRadius(borderType: string): string {
            switch (borderType) {
                case ChicletBorderStyle.ROUNDED:
                    return "10px";
                case ChicletBorderStyle.SQUARE:
                    return "0px";
                default:
                    return "5px";
            }
        }
    }

}
