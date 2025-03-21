// Most of these functions are originally taken getConfigFileFromServer
// https://github.com/GRIFFINCollaboration/AngularCorrelationUtility
// Credit to them
//////////////////
// Physics
//////////////////

function calculateTheoreticalAngularCorrelationCoefficients(j1, j2, j3, l1a, l1b, l2a, l2b, delta1, delta2){
    return([B(2,j2,j1,l1a,l1b,delta1)*A(2,j3,j2,l2a,l2b,delta2),
            B(4,j2,j1,l1a,l1b,delta1)*A(4,j3,j2,l2a,l2b,delta2)]);
};

function calculate_a2(j1, j2, j3, l1a, l1b, l2a, l2b, delta1, delta2){
    return B(2,j2,j1,l1a,l1b,delta1)*A(2,j3,j2,l2a,l2b,delta2);
};

function calculate_a4(j1, j2, j3, l1a, l1b, l2a, l2b, delta1, delta2){
    return B(4,j2,j1,l1a,l1b,delta1)*A(4,j3,j2,l2a,l2b,delta2);
};

function ClebschGordan(j1, m1, j2, m2, j, m){
    var term, cg, term1, sum, k

    // Conditions check
    if( 2*j1 != Math.floor(2*j1) ||
        2*j2 !=   Math.floor(2*j2) ||
        2*j !=   Math.floor(2*j) ||
        2*m1 !=   Math.floor(2*m1) ||
        2*m2 !=   Math.floor(2*m2) ||
        2*m !=   Math.floor(2*m) ){

        //G4cout << "All arguments must be integers or half-integers." << G4endl;
        return 0;
    }

    if(m1 + m2 != m){
        //G4cout << "m1 + m2 must equal m." << G4endl;
        return 0;
    }

    if( j1 - m1 != Math.floor ( j1 - m1 ) ){
        //G4cout << "2*j1 and 2*m1 must have the same parity" << G4endl;
        return 0;
    }

    if( j2 - m2 != Math.floor ( j2 - m2 ) ){
        //G4cout << "2*j2 and 2*m2 must have the same parity" << G4endl;
        return 0;
    }

    if( j - m != Math.floor ( j - m ) ){
        //G4cout << "2*j and 2*m must have the same parity" << G4endl;
        return 0;
    }

    if(j > j1 + j2 || j < Math.abs(j1 - j2)){
        //G4cout << "j is out of bounds." << G4endl;
        return 0;
    }

    if(Math.abs(m1) > j1){
        //G4cout << "m1 is out of bounds." << G4endl;
        return 0;
    }

    if(Math.abs(m2) > j2){
        //G4cout << "m2 is out of bounds." << G4endl;
        return 0;
    }

    if(Math.abs(m) > j){
        //warning('m is out of bounds." << G4endl;
        return 0 ;
    }

    term1 = Math.pow((((2*j+1)/Factorial(j1+j2+j+1))*Factorial(j2+j-j1)*Factorial(j+j1-j2)*Factorial(j1+j2-j)*Factorial(j1+m1)*Factorial(j1-m1)*Factorial(j2+m2)*Factorial(j2-m2)*Factorial(j+m)*Factorial(j-m)),(0.5));
    sum = 0;

    for(k = 0 ; k <= 99 ; k++ ){
        if( (j1+j2-j-k < 0) || (j1-m1-k < 0) || (j2+m2-k < 0) )
            //no further terms will contribute to sum, exit loop
            break
        else if( (j-j1-m2+k < 0) || (j-j2+m1+k < 0)  )
            //jump ahead to next term that will contribute
            k = Math.max(-Math.min(j-j1-m2, j-j2+m1) - 1, k);
        else{
            term = Factorial(j1+j2-j-k)*Factorial(j-j1-m2+k)*Factorial(j-j2+m1+k)*Factorial(j1-m1-k)*Factorial(j2+m2-k)*Factorial(k);
            if((k%2) == 1){
                term = -1*term;
            }
            sum = sum + 1.0/term;
        }
    }

    cg = term1*sum;
    return cg;
    // Reference: An Effective Algorithm for Calculation of the C.G.
    // Coefficients Liang Zuo, et. al.
    // J. Appl. Cryst. (1993). 26, 302-304
};

function Wigner3j(j1, j2, j3, m1, m2, m3){
    var out;
    // Conditions check
    // if( 2*j1 != Math.floor(2*j1) ||
    //     2*j2 != Math.floor(2*j2) ||
    //     2*j3 != Math.floor(2*j3) ||
    //     2*m1 != Math.floor(2*m1) ||
    //     2*m2 != Math.floor(2*m2) ||
    //     2*m3 != Math.floor(2*m3) ){
    //     // G4cout << "All arguments must be integers or half-integers." << G4endl;
    //     return 0;
    // }

    if(m1 + m2 + m3 != 0){
        //G4cout << "m1 + m2 + m3 must equal zero." << G4endl;
        return 0;
    }

    if( j1 + j2 + j3 !=   Math.floor(j1 + j2 + j3) ){
        //G4cout << "2*j1 and 2*m1 must have the same parity" << G4endl;
        return 0;
    }

    if(j3 > j1 + j2 || j3 < Math.abs(j1 - j2)){
        //G4cout << "j3 is out of bounds." << G4endl;
        return 0;
    }

    if(Math.abs(m1) > j1){
        //G4cout << "m1 is out of bounds." << G4endl;
        return 0;
    }

    if(Math.abs(m2) > j2){
        //G4cout << "m2 is out of bounds." << G4endl;
        return 0;
    }

    if(Math.abs(m3) > j3){
        return 0;
    }

    out = (Math.pow((-1),(j1-j2-m3)))/(Math.pow((2*j3+1),(1.0/2.0)))*ClebschGordan(j1,m1,j2,m2,j3,-1*m3);
    return out;
};

function Wigner6j(J1, J2, J3, J4, J5, J6){
    var j1 = J1;
        j2 = J2,
        j12 = J3,
        j3 = J4,
        j = J5,
        j23 = J6,
        sum = 0;

    // Conditions check
    if(J3 > J1 + J2 || J3 < Math.abs(J1 - J2)){
        //G4cout << "first J3 triange condition not satisfied. J3 > J1 + J2 || J3 < Math.abs(J1 - J2)" << G4endl;
        return 0;
    }

    if(J3 > J4 + J5 || J3 < Math.abs(J4 - J5)){
        //G4cout << "second J3 triange condition not satisfied. J3 > J4 + J5 || J3 < Math.abs(J4 - J5)" << G4endl;
        return 0;
    }

    if(J6 > J2 + J4 || J6 < Math.abs(J2 - J4)){
        //G4cout << "first J6 triange condition not satisfied. J6 > J2 + J4 || J6 < Math.abs(J2 - J4)" << G4endl;
        return 0;
    }

    if(J6 > J1 + J5 || J6 < Math.abs(J1 - J5)){
        //G4cout << "second J6 triange condition not satisfied. J6 > J1 + J5 || J6 < Math.abs(J1 - J5)" << G4endl;
        return 0;
    }

    for(var m1 = -j1 ; m1 <= j1 ; m1++ ){
        for(var m2 = -j2 ; m2 <= j2 ; m2++ ){
            for(var m3 = -j3 ; m3 <= j3 ; m3++ ){
                for(var m12 = -j12 ; m12 <= j12 ; m12++ ){
                    for(var m23 = -j23 ; m23 <= j23 ; m23++ ){
                        for(var m = -j ; m <= j ; m++ ){
                            sum = sum + Math.pow((-1),(j3+j+j23-m3-m-m23))*Wigner3j(j1,j2,j12,m1,m2,m12)*Wigner3j(j1,j,j23,m1,-m,m23)*Wigner3j(j3,j2,j23,m3,m2,-m23)*Wigner3j(j3,j,j12,-m3,m,m12);
                        }
                    }
                }
            }
        }
    }
    return sum;
};

function RacahW(a, b, c, d, e, f){
    return Math.pow((-1),(a+b+d+c))*Wigner6j(a,b,e,d,c,f);
};

function F(k, jf, L1, L2, ji){
    var W;
    var CG = ClebschGordan(L1,1,L2,-1,k,0);

    if(CG == 0){
        return 0;
    }
    W = RacahW(ji,ji,L1,L2,k,jf);
    if(W == 0){
        return 0;
    }
    return Math.pow((-1),(jf-ji-1))*(Math.pow((2*L1+1)*(2*L2+1)*(2*ji+1),(1.0/2.0)))*CG*W;
    // Reference: Tables of coefficients for angular distribution of gamma rays from aligned nuclei
    // T. Yamazaki. Nuclear Data A, 3(1):1?23, 1967.
};

function A(k, ji, jf, L1, L2, delta){
    var f1 = F(k,ji,L1,L1,jf),
        f2 = F(k,ji,L1,L2,jf),
        f3 = F(k,ji,L2,L2,jf);

    tabulateA(k, f1,f2,f3);

    return (1/(1+Math.pow(delta,2)))*(f1+2*delta*f2+delta*delta*f3);
};

function tabulateA(k, f1, f2, f3){
    //given precomputed values of F, reconstruct the table of A values for the currently selected momenta, across a range of mixing ratios.
    var i, delta,
        min = dataStore.minMix,
        max = dataStore.maxMix;

    if(k==2)
        dataStore.A2 = [];
    else if(k==4)
        dataStore.A4 = []
    for(i=0; i<=dataStore.steps; i++){
        delta = min + (max-min)*i/dataStore.steps;
        if(k==2)
            dataStore.A2.push( (1/(1+Math.pow(delta,2)))*(f1+2*delta*f2+delta*delta*f3) );
        else if(k==4)
            dataStore.A4.push( (1/(1+Math.pow(delta,2)))*(f1+2*delta*f2+delta*delta*f3) );
    }
}

function B(k, ji, jf, L1, L2, delta){
    var f1 = F(k,jf,L1,L1,ji),
        f2 = F(k,jf,L1,L2,ji),
        f3 = F(k,jf,L2,L2,ji)

    tabulateB(k, f1,f2,f3,L1,L2);

    return (1/(1+Math.pow(delta,2)))*(f1+(Math.pow((-1),((L1+L2))))*2*delta*f2+delta*delta*f3);
};

function tabulateB(k, f1, f2, f3, L1, L2){
    //given precomputed values of F, reconstruct the table of B values for the currently selected momenta, across a range of mixing ratios.
    var i, delta,
        min = dataStore.minMix,
        max = dataStore.maxMix;

    if(k==2)
        dataStore.B2 = [];
    else if(k==4)
        dataStore.B4 = [];
    for(i=0; i<=dataStore.steps; i++){
        delta = min + (max-min)*i/dataStore.steps;
        if(k==2)
            dataStore.B2.push( (1/(1+Math.pow(delta,2)))*(f1+(Math.pow((-1),((L1+L2))))*2*delta*f2+delta*delta*f3) );
        else if (k==4)
            dataStore.B4.push( (1/(1+Math.pow(delta,2)))*(f1+(Math.pow((-1),((L1+L2))))*2*delta*f2+delta*delta*f3) );
    }
}

function evenA(){

    var select, option, i, spin;

    for(spin = 1; spin<4; spin++){
        select = document.getElementById('j'+spin);
        select.innerHTML = '';
        for (i = 0;i<10;i++){
                option = document.createElement('option');
                option.setAttribute('value', i);
                option.innerHTML = i;
                select.appendChild(option);
        }
    }

    document.getElementById("j1").value = 4;
    document.getElementById("j2").value = 2;
    document.getElementById("j3").value = 0;
};

function oddA(){
    var select, option, i, spin;

    for(spin = 1; spin<4; spin++){
        select = document.getElementById('j'+spin);
        select.innerHTML = '';
        for (i = 0;i<10;i++){
                value = (2*i+1)/2;
                numerator = 2*i+1;

                option = document.createElement('option');
                option.setAttribute('value', value);
                option.innerHTML = numerator + '/2';
                select.appendChild(option);
        }
    }

    document.getElementById("j1").value = 2.5;
    document.getElementById("j2").value = 1.5;
    document.getElementById("j3").value = 0.5;
};

/////////////////
// helpers
/////////////////

function Factorial(value){

    var fac;

    if(dataStore.cache.factorial[value]){
        return dataStore.cache.factorial[value];
    } else {
        if(value > 1){
            fac = value*Factorial(value-1);
        } else {
            fac = 1;
        }
        dataStore.cache.factorial[value] = fac;

        return fac;
    }
}
