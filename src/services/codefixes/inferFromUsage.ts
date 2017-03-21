﻿/* @internal */
namespace ts.codefix {
    registerCodeFix({
        errorCodes: [
            // Variable declarations
            Diagnostics.Variable_0_implicitly_has_type_1_in_some_locations_where_its_type_cannot_be_determined.code,
            Diagnostics.Variable_0_implicitly_has_an_1_type.code,

            // Parameter declarations
            Diagnostics.Parameter_0_implicitly_has_an_1_type.code,
            Diagnostics.Rest_parameter_0_implicitly_has_an_any_type.code,

            // Get Accessor declarations
            Diagnostics.Property_0_implicitly_has_type_any_because_its_get_accessor_lacks_a_return_type_annotation.code,
            Diagnostics._0_which_lacks_return_type_annotation_implicitly_has_an_1_return_type.code,

            // Set Accessor declarations
            Diagnostics.Property_0_implicitly_has_type_any_because_its_set_accessor_lacks_a_parameter_type_annotation.code,

            // Property declarations
            Diagnostics.Member_0_implicitly_has_an_1_type.code,
            // Diagnostics.Object_literal_s_property_0_implicitly_has_an_1_type.code,

            // Diagnostics.Binding_element_0_implicitly_has_an_1_type.code,
        ],
        getCodeActions: getActionsForAddExplicitTypeAnnotation
    });

    function getActionsForAddExplicitTypeAnnotation({ sourceFile, program, span: { start }, errorCode, cancellationToken, newLineCharacter }: CodeFixContext): CodeAction[] | undefined {
        const token = getTokenAtPosition(sourceFile, start);

        if (!isIdentifier(token) && token.kind !== SyntaxKind.DotDotDotToken) {
            return undefined;
        }

        const containingFunction = getContainingFunction(token);
        const checker = program.getTypeChecker();

        switch (errorCode) {
            // Variable declarations
            case Diagnostics.Variable_0_implicitly_has_type_1_in_some_locations_where_its_type_cannot_be_determined.code:
                return getCodeActionForVariableDeclaration(<VariableDeclaration>token.parent);
            case Diagnostics.Variable_0_implicitly_has_an_1_type.code:
                return getCodeActionForVariableUsage(<Identifier>token);

            // Paramtert declarations
            case Diagnostics.Parameter_0_implicitly_has_an_1_type.code:
                if (isSetAccessor(containingFunction)) {
                    return getCodeActionForSetAccessor(containingFunction);
                }
                // Fall through
            case Diagnostics.Rest_parameter_0_implicitly_has_an_any_type.code:
                return getCodeActionForParameter(<ParameterDeclaration>token.parent);

            // Get Accessor declarations
            case Diagnostics.Property_0_implicitly_has_type_any_because_its_get_accessor_lacks_a_return_type_annotation.code:
            case Diagnostics._0_which_lacks_return_type_annotation_implicitly_has_an_1_return_type.code:
                return isGetAccessor(containingFunction) ? getCodeActionForGetAccessor(containingFunction) : undefined;

            // Set Accessor declarations
            case Diagnostics.Property_0_implicitly_has_type_any_because_its_set_accessor_lacks_a_parameter_type_annotation.code:
                return isSetAccessor(containingFunction) ? getCodeActionForSetAccessor(containingFunction) : undefined;

            // Property declarations
            case Diagnostics.Member_0_implicitly_has_an_1_type.code:
                // todo
                return undefined;
         }

        function getCodeActionForVariableDeclaration(declaration: VariableDeclaration) {
            const type = inferTypeForVariableFromUsage(declaration.name);
            const typeString = checker.typeToString(type || checker.getAnyType(), declaration, TypeFormatFlags.NoTruncation);
            if (isInJavaScriptFile(sourceFile)) {
                const declarationStatement = getAncestor(declaration, SyntaxKind.VariableStatement);
                if (!declarationStatement.jsDoc) {
                    const newText = `/** @type {${typeString}} */${newLineCharacter}`;
                    return createCodeActions(declaration.getText(), declarationStatement.getStart(), newText);
                }
            }
            else {
                return createCodeActions(declaration.name.getText(), declaration.name.getEnd(), `: ${typeString}`);
            }
        }

        function getCodeActionForVariableUsage(token: Identifier) {
            const symbol = checker.getSymbolAtLocation(token);
            return symbol && symbol.valueDeclaration && getCodeActionForVariableDeclaration(<VariableDeclaration>symbol.valueDeclaration);
        }

        function getCodeActionForParameter(parameterDeclaration: ParameterDeclaration) {
            if (!isIdentifier(parameterDeclaration.name)) {
                return undefined;
            }
            const isRestParameter = !!parameterDeclaration.dotDotDotToken;
            let type = inferTypeForParameterFromUsage(parameterDeclaration.name, isRestParameter);
            if (!isValidInference(type)) {
                type = inferTypeForVariableFromUsage(parameterDeclaration.name);
            }
            const typeString = checker.typeToString(type || checker.getAnyType(), token, TypeFormatFlags.NoTruncation);
            if (isInJavaScriptFile(sourceFile)) {
                if (!containingFunction.jsDoc) {
                    const newText = `/** @param {${typeString}} ${token.getText()} */${newLineCharacter}`;
                    return createCodeActions(parameterDeclaration.name.getText(), containingFunction.getStart(), newText);
                }
            }
            else {
                return createCodeActions(parameterDeclaration.name.getText(), parameterDeclaration.getEnd(), `: ${typeString}`);
            }
        }

        function getCodeActionForSetAccessor(setAccessorDeclaration: SetAccessorDeclaration) {
            const setAccessorParameter = setAccessorDeclaration.parameters[0];
            if (!setAccessorParameter || !isIdentifier(setAccessorParameter.name)) {
                return undefined;
            }

            let type = inferTypeForVariableFromUsage(setAccessorDeclaration.name);
            if (!isValidInference(type)) {
                type = inferTypeForVariableFromUsage(setAccessorParameter.name);
            }

            const typeString = checker.typeToString(type || checker.getAnyType(), token, TypeFormatFlags.NoTruncation);
            if (isInJavaScriptFile(sourceFile)) {
                if (!setAccessorDeclaration.jsDoc) {
                    const newText = `/** @param {${typeString}} ${setAccessorParameter.getText()} */${newLineCharacter}`;
                    return createCodeActions(setAccessorDeclaration.name.getText(), setAccessorDeclaration.getStart(), newText);
                }
            }
            else {
                return createCodeActions(setAccessorDeclaration.name.getText(), setAccessorParameter.name.getEnd(), `: ${typeString}`);
            }
        }

        function getCodeActionForGetAccessor(getAccessorDeclaration: GetAccessorDeclaration) {
            let type = inferTypeForVariableFromUsage(getAccessorDeclaration.name);

            const typeString = checker.typeToString(type || checker.getAnyType(), token, TypeFormatFlags.NoTruncation);
            if (isInJavaScriptFile(sourceFile)) {
                if (!getAccessorDeclaration.jsDoc) {
                    const newText = `/** @type {${typeString}} */${newLineCharacter}`;
                    return createCodeActions(getAccessorDeclaration.name.getText(), getAccessorDeclaration.getStart(), newText);
                }
            }
            else {
                const closeParenToken = getFirstChildOfKind(getAccessorDeclaration, sourceFile, SyntaxKind.CloseParenToken);
                return createCodeActions(getAccessorDeclaration.name.getText(), closeParenToken.getEnd(), `: ${typeString}`);
            }
        }

        function createCodeActions(name: string, start: number, typeString: string) {
            return [{
                description: formatStringFromArgs(getLocaleSpecificMessage(Diagnostics.Infer_type_of_0), [name]),
                changes: [{
                    fileName: sourceFile.fileName,
                    textChanges: [{
                        span: { start, length: 0 },
                        newText: typeString
                    }]
                }]
            }];
        }

        function getReferences(token: PropertyName | Token<SyntaxKind.ConstructorKeyword>) {
            const references = FindAllReferences.findReferencedSymbols(
                checker,
                cancellationToken,
                program.getSourceFiles(),
                token.getSourceFile(),
                token.getStart(),
                /*findInStrings*/ false, /*findInComments*/ false, /*isForRename*/ false);

            Debug.assert(!!references, "Found no references!");
            Debug.assert(references.length === 1, "Found more references than expected");

            return references[0].references;
        }

        function inferTypeForVariableFromUsage(token: BindingName  | PropertyName) {
            if (!isIdentifier(token)) {
                // TODO: Support Binding Patterns
                return undefined;
            }
            const references = getReferences(token).map(r => <Identifier>getTokenAtPosition(program.getSourceFile(r.fileName), r.textSpan.start));
            return inferTypeFromReferences(references, checker);
        }

        function getFirstChildOfKind(node: Node, sourcefile: SourceFile, kind: SyntaxKind) {
            for (const child of node.getChildren(sourcefile)) {
                if (child.kind === kind) return child;
            }
        }

        function inferTypeForParameterFromUsage(token: Identifier, isRestParameter: boolean) {
            if (containingFunction.kind === SyntaxKind.Constructor || containingFunction.kind === SyntaxKind.FunctionExpression ||
                containingFunction.kind === SyntaxKind.FunctionDeclaration || containingFunction.kind === SyntaxKind.MethodDeclaration ||
                containingFunction.kind === SyntaxKind.MethodSignature) {
                const isConstructor = containingFunction.kind === SyntaxKind.Constructor;

                let searchToken = isConstructor ?
                    <Token<SyntaxKind.ConstructorKeyword>>getFirstChildOfKind(containingFunction, sourceFile, SyntaxKind.ConstructorKeyword) :
                    containingFunction.name;
                if (searchToken) {
                    const parameterIndex = getParameterIndexInList(token, containingFunction.parameters);
                    const references = getReferences(searchToken).map(r => <Identifier>getTokenAtPosition(program.getSourceFile(r.fileName), r.textSpan.start));
                    return inferTypeForParameterFromReferences(references, parameterIndex, isConstructor, isRestParameter, checker);
                }
            }
            else {
                return checker.getAnyType();
            }
        }
    }

    interface CallContext {
        argumentTypes: Type[];
        returnType: UsageContext;
    }

    interface UsageContext {
        isNumber?: boolean;
        isString?: boolean;
        isNumberOrString?: boolean;
        candidateTypes?: Type[];
        properties?: Map<UsageContext>;
        callContexts?: CallContext[];
        constructContexts?: CallContext[];
        numberIndexContext?: UsageContext;
        stringIndexContext?: UsageContext;
    }

    function inferTypeFromReferences(references: Identifier[], checker: TypeChecker): Type {
        const usageContext: UsageContext = {};
        for (const reference of references) {
            getTypeFromContext(reference, checker, usageContext);
        }
        return getTypeFromUsageContext(usageContext, checker);
    }

    function inferTypeForParameterFromReferences(references: Identifier[], parameterIndex: number, isConstructor: boolean, isRestParameter: boolean, checker: TypeChecker) {
        const usageContext: UsageContext = {};
        for (const reference of references) {
            getTypeFromContext(reference, checker, usageContext);
        }
        return getParameterTypeFromCallContexts(parameterIndex, isConstructor ? usageContext.constructContexts : usageContext.callContexts, isRestParameter, checker);
    }

    function getTypeFromUsageContext(usageContext: UsageContext, checker: TypeChecker): Type {
        if (usageContext.isNumberOrString && !usageContext.isNumber && !usageContext.isString) {
            return checker.getUnionType([checker.getNumberType(), checker.getStringType()]);
        }
        else if (usageContext.isNumber) {
            return checker.getNumberType();
        }
        else if (usageContext.isString) {
            return checker.getStringType();
        }
        else if (usageContext.candidateTypes) {
            return checker.getWidenedType(checker.getUnionType(map(usageContext.candidateTypes, t => checker.getBaseTypeOfLiteralType(t)), true));
        }
        else if (usageContext.properties && hasCallContext(usageContext.properties.get("then"))) {
            const paramType = getParameterTypeFromCallContexts(0, usageContext.properties.get("then").callContexts, /*isRestParameter*/ false, checker);
            const types = paramType.getCallSignatures().map(c => c.getReturnType());
            return checker.createPromiseType(types.length ? checker.getUnionType(types, true) : checker.getAnyType());
        }
        else if (usageContext.properties && hasCallContext(usageContext.properties.get("push"))) {
            return checker.createArrayType(getParameterTypeFromCallContexts(0, usageContext.properties.get("push").callContexts, /*isRestParameter*/ false, checker));
        }
        else if (usageContext.properties || usageContext.callContexts || usageContext.constructContexts || usageContext.numberIndexContext || usageContext.stringIndexContext) {
            const members = createMap<Symbol>();
            const callSignatures: Signature[] = [];
            const constructSignatures: Signature[] = [];
            let stringIndexInfo: IndexInfo;
            let numberIndexInfo: IndexInfo;

            if (usageContext.properties) {
                usageContext.properties.forEach((context, name) => {
                    const symbol = checker.createSymbol(SymbolFlags.Property, name);
                    symbol.type = getTypeFromUsageContext(context, checker);
                    members.set(name, symbol);
                });
            }

            if (usageContext.callContexts) {
                for (const callConext of usageContext.callContexts) {
                    callSignatures.push(getSignatureFromCallContext(callConext, checker));
                }
            }

            if (usageContext.constructContexts) {
                for (const constructContext of usageContext.constructContexts) {
                    constructSignatures.push(getSignatureFromCallContext(constructContext, checker));
                }
            }

            if (usageContext.numberIndexContext) {
                numberIndexInfo = checker.createIndexInfo(getTypeFromUsageContext(usageContext.numberIndexContext, checker), /*isReadonly*/ false);
            }

            if (usageContext.stringIndexContext) {
                stringIndexInfo = checker.createIndexInfo(getTypeFromUsageContext(usageContext.stringIndexContext, checker), /*isReadonly*/ false);
            }

            return checker.createAnonymousType(/*symbol*/ undefined, members, callSignatures, constructSignatures, stringIndexInfo, numberIndexInfo);
        }
        else {
            return checker.getAnyType();
        }
    }

    function getParameterTypeFromCallContexts(parameterIndex: number, callContexts: CallContext[], isRestParameter: boolean, checker: TypeChecker) {
        let types: Type[]  = [];
        if (callContexts) {
            for (const callContext of callContexts) {
                if (callContext.argumentTypes.length > parameterIndex) {
                    if (isRestParameter) {
                        types = concatenate(types, map(callContext.argumentTypes.slice(parameterIndex), a => checker.getBaseTypeOfLiteralType(a)));
                    }
                    else {
                        types.push(checker.getBaseTypeOfLiteralType(callContext.argumentTypes[parameterIndex]));
                    }
                }
            }
        }
        const type = types.length ? checker.getWidenedType(checker.getUnionType(types, true)) : checker.getAnyType();
        return isRestParameter ? checker.createArrayType(type) : type;
    }

    function getSignatureFromCallContext(callContext: CallContext, checker: TypeChecker): Signature {
        const parameters: Symbol[] = [];
        for (let i = 0; i < callContext.argumentTypes.length; i++) {
            const symbol = checker.createSymbol(SymbolFlags.FunctionScopedVariable, `p${i}`);
            symbol.type = checker.getWidenedType(checker.getBaseTypeOfLiteralType(callContext.argumentTypes[i]));
            parameters.push(symbol);
        }
        const returnType = getTypeFromUsageContext(callContext.returnType, checker);
        return checker.createSignature(/*declaration*/ undefined, /*typeParameters*/ undefined, /*thisParameter*/ undefined, parameters, returnType, /*typePredicate*/ undefined, callContext.argumentTypes.length, /*hasRestParameter*/ false, /*hasLiteralTypes*/ false);
    }

    function hasCallContext(usageContext: UsageContext) {
        return usageContext && usageContext.callContexts;
    }

    function getTypeFromContext(node: Expression, checker: TypeChecker, usageContext: UsageContext): void {
        while (isRightSideOfQualifiedNameOrPropertyAccess(node)) {
            node = <Expression>node.parent;
        }

        switch (node.parent.kind) {
            case SyntaxKind.PostfixUnaryExpression:
                usageContext.isNumber = true;
                break;
            case SyntaxKind.PrefixUnaryExpression:
                getTypeFromPrefixUnaryExpressionContext(<PrefixUnaryExpression>node.parent, usageContext);
                break;
            case SyntaxKind.BinaryExpression:
                getTypeFromBinaryExpressionContext(node, <BinaryExpression>node.parent, checker, usageContext);
                break;
            case SyntaxKind.CaseClause:
            case SyntaxKind.DefaultClause:
                getTypeFromSwitchStatementLabelContext(<CaseOrDefaultClause>node.parent, checker, usageContext);
                break;
            case SyntaxKind.CallExpression:
            case SyntaxKind.NewExpression:
                if ((<CallExpression | NewExpression>node.parent).expression === node) {
                    getTypeFromCallExpressionContext(<CallExpression | NewExpression>node.parent, checker, usageContext);
                }
                else {
                    getContextualType(node, checker, usageContext);
                }
                break;
            case SyntaxKind.PropertyAccessExpression:
                getTypeFromPropertyAccessExpressionContext(<PropertyAccessExpression>node.parent, checker, usageContext);
                break;
            case SyntaxKind.ElementAccessExpression:
                getTypeFromPropertyElementExpressionContext(<ElementAccessExpression>node.parent, node, checker, usageContext);
                break;
            default:
                return getContextualType(node, checker, usageContext);
        }
    }

    function getContextualType(node: Expression, checker: TypeChecker, usageContext: UsageContext): void {
        if (isPartOfExpression(node)) {
            addCandidateType(usageContext, checker.getContextualType(node));
        }
    }

    function getTypeFromPrefixUnaryExpressionContext(node: PrefixUnaryExpression, usageContext: UsageContext): void {
        switch (node.operator) {
            case SyntaxKind.PlusPlusToken:
            case SyntaxKind.MinusMinusToken:
            case SyntaxKind.MinusToken:
            case SyntaxKind.TildeToken:
                usageContext.isNumber = true;
                break;

            case SyntaxKind.PlusToken:
                usageContext.isNumberOrString = true;
                break;

            // case SyntaxKind.ExclamationToken:
            // no inferences here;
        }
    }

    function getTypeFromBinaryExpressionContext(node: Expression, parent: BinaryExpression, checker: TypeChecker, usageContext: UsageContext): void {
        switch (parent.operatorToken.kind) {
            // ExponentiationOperator
            case SyntaxKind.AsteriskAsteriskToken:

            // MultiplicativeOperator
            case SyntaxKind.AsteriskToken:
            case SyntaxKind.SlashToken:
            case SyntaxKind.PercentToken:

            // ShiftOperator
            case SyntaxKind.LessThanLessThanToken:
            case SyntaxKind.GreaterThanGreaterThanToken:
            case SyntaxKind.GreaterThanGreaterThanGreaterThanToken:

            // BitwiseOperator
            case SyntaxKind.AmpersandToken:
            case SyntaxKind.BarToken:
            case SyntaxKind.CaretToken:

            // CompoundAssignmentOperator
            case SyntaxKind.MinusEqualsToken:
            case SyntaxKind.AsteriskAsteriskEqualsToken:
            case SyntaxKind.AsteriskEqualsToken:
            case SyntaxKind.SlashEqualsToken:
            case SyntaxKind.PercentEqualsToken:
            case SyntaxKind.AmpersandEqualsToken:
            case SyntaxKind.BarEqualsToken:
            case SyntaxKind.CaretEqualsToken:
            case SyntaxKind.LessThanLessThanEqualsToken:
            case SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken:
            case SyntaxKind.GreaterThanGreaterThanEqualsToken:

            // AdditiveOperator
            case SyntaxKind.MinusToken:

            // RelationalOperator
            case SyntaxKind.LessThanToken:
            case SyntaxKind.LessThanEqualsToken:
            case SyntaxKind.GreaterThanToken:
            case SyntaxKind.GreaterThanEqualsToken:
                const operandType = checker.getTypeAtLocation(parent.left === node ? parent.right : parent.left);
                if (operandType.flags & TypeFlags.EnumLike) {
                    addCandidateType(usageContext, operandType);
                }
                else {
                    usageContext.isNumber = true;
                }
                break;

            case SyntaxKind.PlusEqualsToken:
            case SyntaxKind.PlusToken:
                const otherOperandType = checker.getTypeAtLocation(parent.left === node ? parent.right : parent.left);
                if (otherOperandType.flags & TypeFlags.EnumLike) {
                    addCandidateType(usageContext, otherOperandType);
                }
                else if (otherOperandType.flags & TypeFlags.NumberLike) {
                    addCandidateType(usageContext, checker.getNumberType());
                }
                else if (otherOperandType.flags & TypeFlags.StringLike) {
                    addCandidateType(usageContext, checker.getStringType());
                }
                else {
                    usageContext.isNumberOrString = true;
                }
                break;

            //  AssignmentOperators
            case SyntaxKind.EqualsToken:
            case SyntaxKind.EqualsEqualsToken:
            case SyntaxKind.EqualsEqualsEqualsToken:
            case SyntaxKind.ExclamationEqualsEqualsToken:
            case SyntaxKind.ExclamationEqualsToken:
                addCandidateType(usageContext, checker.getTypeAtLocation(parent.left === node ? parent.right : parent.left));
                break;

            case SyntaxKind.InKeyword:
                if (node === parent.left) {
                    usageContext.isString = true;
                }
                break;

            // LogicalOperator
            case SyntaxKind.BarBarToken:
                if (node === parent.left &&
                    (node.parent.parent.kind === SyntaxKind.VariableDeclaration || isAssignmentExpression(node.parent.parent, /*excludeCompoundAssignment*/ true))) {
                    // var x = x || {};
                    // TODO: use getFalsyflagsOfType
                    addCandidateType(usageContext, checker.getTypeAtLocation(parent.right));
                }
                break;

            case SyntaxKind.AmpersandAmpersandToken:
            case SyntaxKind.CommaToken:
            case SyntaxKind.InstanceOfKeyword:
                // nothing to infer here
                break;
        }
    }

    function getTypeFromSwitchStatementLabelContext(parent: CaseOrDefaultClause, checker: TypeChecker, usageContext: UsageContext): void {
        addCandidateType(usageContext, checker.getTypeAtLocation((<SwitchStatement>parent.parent.parent).expression));
    }

    function getTypeFromCallExpressionContext(parent: CallExpression | NewExpression, checker: TypeChecker, usageContext: UsageContext): void {
        const callContext: CallContext = {
            argumentTypes: parent.arguments.map(a => checker.getTypeAtLocation(a)),
            returnType: {}
        };

        getTypeFromContext(parent, checker, callContext.returnType);
        if (parent.kind === SyntaxKind.CallExpression) {
            (usageContext.callContexts || (usageContext.callContexts = [])).push(callContext);
        }
        else {
            (usageContext.constructContexts || (usageContext.constructContexts = [])).push(callContext);
        }
    }

    function getTypeFromPropertyAccessExpressionContext(parent: PropertyAccessExpression, checker: TypeChecker, usageContext: UsageContext): void {
        const name = parent.name.text;
        if (!usageContext.properties) {
            usageContext.properties = createMap<UsageContext>();
        }
        const propertyUsageContext = {};
        getTypeFromContext(parent, checker, propertyUsageContext);
        usageContext.properties.set(name, propertyUsageContext);
    }

    function getTypeFromPropertyElementExpressionContext(parent: ElementAccessExpression, node: Expression, checker: TypeChecker, usageContext: UsageContext): void {
        if (node === parent.argumentExpression) {
            usageContext.isNumberOrString = true;
            return;
        }
        else {
            const indextType = checker.getTypeAtLocation(parent);
            const indexUsageContext = {};
            getTypeFromContext(parent, checker, indexUsageContext);
            if (indextType.flags & TypeFlags.NumberLike) {
                usageContext.numberIndexContext = indexUsageContext;
            }
            else {
                usageContext.stringIndexContext = indexUsageContext;
            }
        }
    }

    function addCandidateType(context: UsageContext, type: Type) {
        if (isValidInference(type)) {
            (context.candidateTypes || (context.candidateTypes = [])).push(type);
        }
    }

    function isValidInference(type: Type) {
        return type && !(type.flags & TypeFlags.Any) && !(type.flags & TypeFlags.Never);
    }

    function getParameterIndexInList(parameter: Identifier, list: NodeArray<ParameterDeclaration>) {
        var paramDeclaration = <ParameterDeclaration>getAncestor(parameter, SyntaxKind.Parameter);
        for (let i = 0; i < list.length; i++) {
            if (paramDeclaration === list[i]) return i;
        }
    }
}