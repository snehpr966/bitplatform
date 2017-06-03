﻿/// <reference path="../../foundation.viewmodel.htmlclient/foundation.viewmodel.d.ts" />

module Foundation.View.Directives {
    @Core.DirectiveDependency({ name: "radCombo" })
    export class DefaultRadComboDirective implements ViewModel.Contracts.IDirective {

        public static defaultRadComboDirectiveCustomizers: Array<($scope: ng.IScope, attribues: ng.IAttributes, element: JQuery, comboBoxOptions: kendo.ui.ComboBoxOptions) => void> = [];

        public getDirectiveFactory(): ng.IDirectiveFactory {
            return () => ({
                scope: false,
                replace: true,
                terminal: true,
                require: {
                    mdInputContainer: "^?mdInputContainer",
                    ngModel: "ngModel"
                },
                template: (element: JQuery, attrs: ng.IAttributes) => {

                    const itemTemplate = element
                        .children("item-template");

                    const guidUtils = Core.DependencyManager.getCurrent().resolveObject<ViewModel.Implementations.GuidUtils>("GuidUtils");

                    if (itemTemplate.length != 0) {

                        const itemTemplateId = guidUtils.newGuid();

                        angular.element(document.body).append(itemTemplate.attr("id", itemTemplateId).attr("ng-cloak", ""));

                        attrs["itemTemplateId"] = itemTemplateId;
                    }

                    const headerTemplate = angular.element(element)
                        .children("header-template");

                    if (headerTemplate.length != 0) {

                        const headerTemplateId = guidUtils.newGuid();

                        headerTemplate
                            .attr("id", headerTemplateId)
                            .attr("ng-cloak", "");

                        angular.element(document.body).append(headerTemplate);

                        attrs["headerTemplateId"] = headerTemplateId;
                    }

                    const replaceAll = (text: string, search: string, replacement: string) => {
                        return text.replace(new RegExp(search, "g"), replacement);
                    };

                    const isolatedOptionsKey = `options${replaceAll(guidUtils.newGuid(), "-", "")}`;

                    attrs["isolatedOptionsKey"] = isolatedOptionsKey;

                    let ngModelOptions = "";
                    if (attrs["ngModel"] != null && attrs["ngModelOptions"] == null) {
                        ngModelOptions = `ng-model-options="{ updateOn : 'change' , allowInvalid : true }"`;
                    }

                    const template = `<input ${ngModelOptions} kendo-combo-box k-options="::${isolatedOptionsKey}" k-ng-delay="::${isolatedOptionsKey}"></input>`;

                    return template;
                },
                link($scope: ng.IScope, element: JQuery, attributes: ng.IAttributes & { ngModel: string, radText: string, radDatasource: string, radValueFieldName: string, radTextFieldName: string, radVirtualEntityLoader: string, radOnInit: string }, requireArgs: { mdInputContainer: { element: JQuery }, ngModel: ng.INgModelController }) {

                    const dependencyManager = Core.DependencyManager.getCurrent();

                    const $timeout = dependencyManager.resolveObject<ng.ITimeoutService>("$timeout");
                    const $parse = dependencyManager.resolveObject<ng.IParseService>("$parse");

                    $timeout(() => {

                        const watches = attributes.radText != null ? [attributes.radDatasource, (() => {
                            const modelParts = attributes.radText.split(".");
                            modelParts.pop();
                            const modelParentProp = modelParts.join(".");
                            return modelParentProp;
                        })()] : [attributes.radDatasource];

                        let model = null;

                        const watchForDatasourceAndNgModelIfAnyToCreateComboWidgetUnRegisterHandler = $scope.$watchGroup(watches, (values: Array<any>) => {

                            if (values == null || values.length == 0 || values.some(v => v == null))
                                return;

                            let dataSource: kendo.data.DataSource = values[0];

                            if (values.length == 2) {
                                model = values[1];
                            }

                            watchForDatasourceAndNgModelIfAnyToCreateComboWidgetUnRegisterHandler();

                            let radValueFieldName = attributes.radValueFieldName;
                            let radTextFieldName = attributes.radTextFieldName;

                            let splittedNgModel = attributes.ngModel.split('.');
                            let bindedMemberName = splittedNgModel.pop();
                            let parentOfNgModel = $parse(splittedNgModel.join('.'))($scope);

                            if (parentOfNgModel != null && parentOfNgModel instanceof $data.Entity) {
                                let parentOfNgModelType = parentOfNgModel.getType();
                                if (parentOfNgModelType.memberDefinitions[`$${bindedMemberName}`] == null)
                                    throw new Error(`${parentOfNgModelType['fullName']} has no member named ${bindedMemberName}`);
                                let metadata = dependencyManager.resolveObject<Foundation.ViewModel.Contracts.IMetadataProvider>("MetadataProvider").getMetadataSync();
                                let dtoMetadata = metadata.Dtos.find(d => d.DtoType == parentOfNgModelType['fullName']);
                                if (dtoMetadata != null) {
                                    let thisDSMemberType = dataSource.options.schema['jayType'];
                                    if (thisDSMemberType != null) {
                                        let lookup = dtoMetadata.MembersLookups.find(l => l.DtoMemberName == bindedMemberName && l.LookupDtoType == thisDSMemberType['fullName']);
                                        if (lookup != null) {
                                            if (lookup.BaseFilter_JS != null) {
                                                let originalRead = dataSource['transport'].read;
                                                dataSource['transport'].read = function (options) {
                                                    options.lookupBaseFilter = lookup.BaseFilter_JS;
                                                    return originalRead.apply(this, arguments);
                                                }
                                            }
                                            if (radTextFieldName == null)
                                                radTextFieldName = lookup.DataTextField;
                                            if (radValueFieldName == null)
                                                radValueFieldName = lookup.DataValueField;
                                        }
                                    }
                                }
                            }

                            if (radValueFieldName == null) {
                                if (dataSource.options.schema != null && dataSource.options.schema.model != null && dataSource.options.schema.model.idField != null)
                                    radValueFieldName = dataSource.options.schema.model.idField;
                            }

                            let ngModelAssign = null;

                            if (attributes.ngModel != null)
                                ngModelAssign = $parse(attributes.ngModel).assign;

                            let text: string = null;
                            let parsedText: ng.ICompiledExpression;

                            if (attributes.radText != null) {

                                parsedText = $parse(attributes.radText);

                                text = parsedText($scope);

                                if (text == "")
                                    text = null;

                                if (attributes.ngModel != null) {
                                    $scope.$watch(attributes.ngModel.replace("::", ""), (newValue) => {
                                        const current = dataSource.current;
                                        if (current != null)
                                            parsedText.assign($scope, current[attributes.radTextFieldName]);
                                        else if (requireArgs.ngModel.$isEmpty(newValue))
                                            parsedText.assign($scope, "");
                                    });
                                }
                            }

                            let kendoWidgetCreatedDisposal = $scope.$on("kendoWidgetCreated", (event, combo: kendo.ui.ComboBox) => {

                                if (combo.element[0] != element[0]) {
                                    return;
                                }

                                kendoWidgetCreatedDisposal();

                                $scope.$on("$destroy", () => {

                                    delete dataSource.current;

                                    if (combo.wrapper != null) {

                                        combo.wrapper.each(function (id, kElement) {
                                            const dataObj = angular.element(kElement).data();
                                            for (let mData in dataObj) {
                                                if (dataObj.hasOwnProperty(mData)) {
                                                    if (angular.isObject(dataObj[mData])) {
                                                        if (typeof dataObj[mData]["destroy"] == "function") {
                                                            dataObj[mData].destroy();
                                                        }
                                                    }
                                                }
                                            }
                                        });

                                        combo.wrapper.remove();
                                    }

                                    combo.destroy();

                                });

                                if (requireArgs.mdInputContainer != null) {

                                    const mdInputContainerParent = requireArgs.mdInputContainer.element;

                                    combo.wrapper
                                        .focusin(() => {
                                            if (angular.element(element).is(":disabled"))
                                                return;
                                            mdInputContainerParent.addClass("md-input-focused");
                                        });

                                    const $destroyDisposal = $scope.$on("$destroy", () => {
                                        combo.wrapper.unbind("focusin");
                                        $destroyDisposal();
                                    });
                                }

                                Object.defineProperty(dataSource, "current", {
                                    configurable: true,
                                    enumerable: false,
                                    get: () => {

                                        let newCurrent = null;

                                        const dataItem = combo.dataItem();

                                        if (dataItem == null)
                                            newCurrent = null;
                                        else
                                            newCurrent = dataItem.innerInstance != null ? dataItem.innerInstance() : dataItem;

                                        if (newCurrent == null && parsedText != null && !requireArgs.ngModel.$isEmpty(combo.value()) && combo.options.autoBind == false) {
                                            newCurrent = {};
                                            newCurrent[radValueFieldName] = combo.value();
                                            newCurrent[radTextFieldName] = parsedText($scope);
                                        };

                                        return newCurrent;
                                    },
                                    set: (entity: $data.Entity) => {

                                        if (entity != null) {
                                            let value = entity[radValueFieldName]
                                            if (combo.value() != value)
                                                combo.value(value);
                                        }
                                        else {
                                            if (combo.value() != null)
                                                combo.value(null);
                                            if (combo.text() != null)
                                                combo.text(null);
                                        }

                                        if (ngModelAssign != null) {
                                            ngModelAssign($scope, null);
                                        }

                                        dataSource.onCurrentChanged();
                                    }
                                });
                            });

                            const comboBoxOptions: kendo.ui.ComboBoxOptions = {
                                dataSource: dataSource,
                                autoBind: dataSource.flatView().length != 0 || attributes.radText == null,
                                dataTextField: radTextFieldName,
                                dataValueField: radValueFieldName,
                                filter: "contains",
                                minLength: 3,
                                valuePrimitive: true,
                                ignoreCase: true,
                                suggest: true,
                                highlightFirst: true,
                                change: (e) => {
                                    dataSource.onCurrentChanged();
                                },
                                open: (e) => {
                                    if (e.sender.options.autoBind == false && attributes.radText != null) {
                                        e.sender.options.autoBind = true;
                                        if (e.sender.options.dataSource.flatView().length == 0)
                                            (e.sender.options.dataSource as kendo.data.DataSource).fetch();
                                    }
                                },
                                delay: 300,
                                popup: {
                                    appendTo: "md-dialog"
                                }
                            };

                            if (text != null)
                                comboBoxOptions.text = text;

                            if (attributes["itemTemplateId"] != null) {

                                let itemTemplateElement = angular.element(`#${attributes["itemTemplateId"]}`);

                                let itemTemplateElementHtml = itemTemplateElement.html();

                                let itemTemplate: any = kendo.template(itemTemplateElementHtml, { useWithBlock: false });

                                comboBoxOptions.template = itemTemplate;
                            }

                            if (attributes["headerTemplateId"] != null) {

                                let headerTemplateElement = angular.element(`#${attributes["headerTemplateId"]}`);

                                let headerTemplateElementHtml = headerTemplateElement.html();

                                let headerTemplate: any = kendo.template(headerTemplateElementHtml, { useWithBlock: false });

                                comboBoxOptions.headerTemplate = headerTemplate;
                            }

                            if (dataSource.options.schema.model.fields[comboBoxOptions.dataTextField] == null)
                                throw new Error(`Model has no property named ${comboBoxOptions.dataTextField} to be used as text field`);

                            if (dataSource.options.schema.model.fields[comboBoxOptions.dataValueField] == null)
                                throw new Error(`Model has no property named ${comboBoxOptions.dataValueField} to be used as value field`);

                            if (attributes.radVirtualEntityLoader != null) {

                                let radVirtualEntityLoader = $parse(attributes.radVirtualEntityLoader);

                                comboBoxOptions.virtual = {
                                    mapValueTo: 'dataItem',
                                    valueMapper: async (options: { value: string, success: (e: Array<any>) => void }): Promise<void> => {

                                        try {

                                            if (requireArgs.ngModel.$isEmpty(options.value)) {
                                                options.success([]);
                                                return;
                                            }

                                            let items = $.makeArray(dataSource.data())
                                                .filter(t => t[comboBoxOptions.dataValueField] == options.value);

                                            if (items.length == 0) {
                                                items = [(await radVirtualEntityLoader($scope, { id: options.value }))];
                                            }

                                            options.success(items);

                                            setTimeout(() => {
                                                let combo = element.data("kendoComboBox");
                                                if (combo == null)
                                                    return;
                                                let input = combo.wrapper.find("input");
                                                let item = items[0];
                                                input.text(item[comboBoxOptions.dataTextField]);
                                            }, 0);

                                        }
                                        finally {
                                            ViewModel.ScopeManager.update$scope($scope);
                                        }

                                    }
                                }
                            }

                            DefaultRadComboDirective.defaultRadComboDirectiveCustomizers.forEach(radComboCustomizer => {
                                radComboCustomizer($scope, attributes, element, comboBoxOptions);
                            });

                            if (attributes.radOnInit != null) {
                                let radOnInitFN = $parse(attributes.radOnInit);
                                if (typeof radOnInitFN == "function") {
                                    radOnInitFN($scope, { comboBoxOptions: comboBoxOptions });
                                }
                            }

                            $scope[attributes["isolatedOptionsKey"]] = comboBoxOptions;

                        });
                    });
                }
            });
        }
    }
}